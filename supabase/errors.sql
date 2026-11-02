-- Hordefall error reports: when the game crashes or hits an error on a player's
-- phone, it sends a short report here so the admin hears about bugs. Paste this
-- into the Supabase SQL editor and run it once, after save-backups.sql. Running
-- it again is safe: it adds what is missing and replaces the functions.
--
-- Reports of the same error are merged into one row with a count, so the table
-- stays small. Anyone (signed in or not) can send a report through
-- report_error; only admins (public.save_admins) can read or clear them, on
-- admin.html under "Error reports".

create table if not exists public.error_reports (
  fingerprint text primary key,
  message text not null,
  stack text not null default '',
  place text not null default '',
  user_agent text not null default '',
  stage integer,
  last_user uuid references auth.users (id) on delete set null,
  count integer not null default 1,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create index if not exists error_reports_seen on public.error_reports (last_seen desc);
alter table public.error_reports enable row level security;

create or replace function public.report_error(p_fingerprint text, p_message text, p_stack text, p_place text, p_user_agent text, p_stage integer)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if p_fingerprint is null or p_fingerprint !~ '^[a-z0-9]{1,16}$' or coalesce(btrim(p_message), '') = '' then
    return;
  end if;
  update error_reports set count = count + 1, last_seen = now(),
      last_user = coalesce(me, last_user), stage = coalesce(p_stage, stage)
    where fingerprint = p_fingerprint;
  if found then
    return;
  end if;
  -- A flood of brand-new errors (or someone spamming) can't fill the table: 200 new kinds an hour at most.
  if (select count(*) from error_reports where first_seen > now() - interval '1 hour') >= 200 then
    return;
  end if;
  insert into error_reports (fingerprint, message, stack, place, user_agent, stage, last_user)
    values (p_fingerprint, left(p_message, 300), left(coalesce(p_stack, ''), 2000), left(coalesce(p_place, ''), 200),
            left(coalesce(p_user_agent, ''), 300), p_stage, me)
    on conflict (fingerprint) do update set count = error_reports.count + 1, last_seen = now();
  -- Keep the 500 most recent kinds of error.
  delete from error_reports where fingerprint in (select fingerprint from error_reports order by last_seen desc offset 500);
end $$;

-- Admins: the most recent errors first.
create or replace function public.admin_error_reports()
returns table (fingerprint text, message text, stack text, place text, user_agent text, stage integer, count integer, first_seen timestamptz, last_seen timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from save_admins where user_id = auth.uid()) then raise exception 'Admins only.'; end if;
  return query select e.fingerprint, e.message, e.stack, e.place, e.user_agent, e.stage, e.count, e.first_seen, e.last_seen
    from error_reports e order by e.last_seen desc limit 200;
end $$;

-- Admins: mark an error fixed (it comes back as new if it happens again).
create or replace function public.admin_clear_error(p_fingerprint text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from save_admins where user_id = auth.uid()) then raise exception 'Admins only.'; end if;
  delete from error_reports where fingerprint = p_fingerprint;
end $$;

revoke all on function public.report_error(text, text, text, text, text, integer) from public;
grant execute on function public.report_error(text, text, text, text, text, integer) to anon, authenticated;
revoke all on function public.admin_error_reports(), public.admin_clear_error(text) from public, anon;
grant execute on function public.admin_error_reports(), public.admin_clear_error(text) to authenticated;
