// Hordefall password reset (Supabase Edge Function "password-reset").
// The game sends a username; if that player added a recovery email (recovery.sql),
// this makes a Supabase reset link and emails it with Resend. The answer is the
// same whether or not the account or email exists, so nobody can probe accounts.
//
// Secrets (Edge Functions > Secrets): RESEND_API_KEY. Optional: RESET_FROM
// (default "Hordefall <noreply@hordefallidle.com>"), SITE_URL (default
// https://hordefallidle.com/). SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are
// provided by Supabase. Turn "Verify JWT" off for this function: players who
// forgot their password aren't signed in.
import { createClient } from 'npm:@supabase/supabase-js@2';

const USERNAME_DOMAIN = 'players.hordefall.invalid';
/** One email per account per this many minutes. */
const WAIT_MINUTES = 10;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const done = () => reply({ ok: true });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply({ error: 'POST only' }, 405);
  let username = '';
  try {
    username = String((await req.json())?.username ?? '').trim().toLowerCase();
  } catch {
    return reply({ error: 'Bad request' }, 400);
  }
  if (!/^[a-z0-9_]{3,20}$/.test(username)) return done();

  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) return reply({ error: 'Password reset emails are not set up yet.' }, 503);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const site = Deno.env.get('SITE_URL') ?? 'https://hordefallidle.com/';

  const link = await admin.auth.admin.generateLink({ type: 'recovery', email: `${username}@${USERNAME_DOMAIN}`, options: { redirectTo: site } });
  const user = link.data?.user;
  if (link.error || !user) return done();
  const { data: row } = await admin.from('account_emails').select('email, last_reset_at').eq('user_id', user.id).maybeSingle();
  if (!row?.email) return done();
  if (row.last_reset_at && Date.now() - Date.parse(row.last_reset_at) < WAIT_MINUTES * 60_000) return done();

  const url = link.data.properties.action_link;
  const sent = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('RESET_FROM') ?? 'Hordefall <noreply@hordefallidle.com>',
      to: [row.email],
      subject: 'Reset your Hordefall password',
      text: `Hi ${username},\n\nTap this link to pick a new Hordefall password:\n${url}\n\nThe link works once and expires in an hour. If you didn't ask for this, ignore this email.`,
      html: `<p>Hi ${username},</p><p><a href="${url}">Tap here to pick a new Hordefall password</a>.</p><p>The link works once and expires in an hour. If you didn't ask for this, ignore this email.</p>`,
    }),
  });
  if (!sent.ok) {
    console.error('Resend', sent.status, await sent.text());
    return reply({ error: 'The email could not be sent. Try again later.' }, 502);
  }
  await admin.from('account_emails').update({ last_reset_at: new Date().toISOString() }).eq('user_id', user.id);
  return done();
});
