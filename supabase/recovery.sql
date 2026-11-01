-- Hordefall password reset emails. Paste this into the Supabase SQL editor and
-- run it once, after setup.sql. Running it again is safe.
--
-- Players sign in with a username, so Supabase only knows a made-up address for
-- them. A player can add a real email here (Settings > Account); the
-- password-reset Edge Function (supabase/functions/password-reset) sends the
-- reset link to it. Only the player can read or change their own email.

create table if not exists public.account_emails (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null check (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  last_reset_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.account_emails enable row level security;

drop policy if exists "Players read their own email" on public.account_emails;
create policy "Players read their own email" on public.account_emails for select to authenticated using (user_id = auth.uid());

-- Add, change or (with an empty text) remove this player's recovery email.
create or replace function public.set_recovery_email(p_email text) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in first.'; end if;
  p_email := lower(btrim(coalesce(p_email, '')));
  if p_email = '' then
    delete from account_emails where user_id = me;
    return;
  end if;
  if char_length(p_email) > 254 or p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'That doesn''t look like an email address.'; end if;
  insert into account_emails (user_id, email) values (me, p_email)
    on conflict (user_id) do update set email = excluded.email, updated_at = now();
end $$;

revoke all on function public.set_recovery_email(text) from public, anon;
grant execute on function public.set_recovery_email(text) to authenticated;
