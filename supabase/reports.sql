-- Hordefall player reports: players can report a message in all chat or guild
-- chat, or a player's username, to the admin. Paste this into the Supabase SQL
-- editor and run it once, after save-backups.sql (and after chat.sql and
-- guilds.sql). Running it again is safe: it adds what is missing and replaces
-- the functions.
--
-- The server copies the reported message itself, so a report can't be faked.
-- Admins (public.save_admins) see open reports on admin.html, can delete the
-- reported message, and mark a report done.

create table if not exists public.player_reports (
  id bigint generated always as identity primary key,
  reporter uuid not null references auth.users (id) on delete cascade,
  reported uuid references auth.users (id) on delete cascade,
  reported_name text not null,
  -- 'chat' (all chat), 'guild' (guild chat) or 'name' (username)
  kind text not null check (kind in ('chat', 'guild', 'name')),
  message_id bigint,
  body text not null default '',
  done boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists player_reports_open on public.player_reports (done, created_at desc);
create index if not exists player_reports_reporter on public.player_reports (reporter, created_at desc);
alter table public.player_reports enable row level security;

create or replace function public.report_name_of(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(u.raw_user_meta_data ->> 'username', split_part(u.email, '@', 1)) from auth.users u where u.id = p_user
$$;

-- Report a message (p_kind 'chat' or 'guild', with its id) or a player's name (p_kind 'name', with p_user).
create or replace function public.report_player(p_kind text, p_message bigint, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  who uuid;
  msg text := '';
begin
  if me is null then raise exception 'Sign in to report.'; end if;
  if p_kind = 'chat' then
    select w.user_id, w.body into who, msg from world_messages w where w.id = p_message;
  elsif p_kind = 'guild' then
    -- Only a message from the reporter's own guild.
    select g.user_id, g.body into who, msg from guild_messages g
      where g.id = p_message and g.guild_id = (select m.guild_id from guild_members m where m.user_id = me);
  elsif p_kind = 'name' then
    who := p_user;
  else
    raise exception 'Unknown report.';
  end if;
  if who is null or not exists (select 1 from auth.users where id = who) then raise exception 'That message or player is gone.'; end if;
  if who = me then raise exception 'You can''t report yourself.'; end if;
  -- Once is enough: the same message (or name) from the same player only counts once.
  if exists (select 1 from player_reports r where r.reporter = me and r.kind = p_kind and r.reported = who
             and (p_kind = 'name' or r.message_id = p_message) and not r.done) then
    return;
  end if;
  if (select count(*) from player_reports where reporter = me and created_at > now() - interval '1 day') >= 20 then
    raise exception 'You''ve sent a lot of reports today. Thanks! Try again tomorrow.';
  end if;
  insert into player_reports (reporter, reported, reported_name, kind, message_id, body)
    values (me, who, coalesce(report_name_of(who), 'player'), p_kind, case when p_kind = 'name' then null else p_message end, left(coalesce(msg, ''), 200));
end $$;

-- Admins: open reports, newest first, with how many players reported the same message or name.
create or replace function public.admin_player_reports()
returns table (id bigint, kind text, reported uuid, reported_name text, reporter_name text, message_id bigint, body text, reports bigint, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from save_admins where user_id = auth.uid()) then raise exception 'Admins only.'; end if;
  return query
    select r.id, r.kind, r.reported, r.reported_name, report_name_of(r.reporter), r.message_id, r.body,
      count(*) over (partition by r.kind, r.reported, coalesce(r.message_id, 0)), r.created_at
    from player_reports r where not r.done order by r.created_at desc limit 200;
end $$;

-- Admins: close a report (and every open report of the same message or name); optionally delete the message.
create or replace function public.admin_close_report(p_id bigint, p_delete_message boolean)
returns void language plpgsql security definer set search_path = public as $$
declare r player_reports;
begin
  if not exists (select 1 from save_admins where user_id = auth.uid()) then raise exception 'Admins only.'; end if;
  select * into r from player_reports where id = p_id;
  if r.id is null then return; end if;
  if coalesce(p_delete_message, false) and r.message_id is not null then
    if r.kind = 'chat' then delete from world_messages where id = r.message_id;
    elsif r.kind = 'guild' then delete from guild_messages where id = r.message_id;
    end if;
  end if;
  update player_reports set done = true
    where not done and kind = r.kind and reported is not distinct from r.reported and message_id is not distinct from r.message_id;
end $$;

revoke all on function public.report_name_of(uuid) from public, anon, authenticated;
revoke all on function public.report_player(text, bigint, uuid) from public, anon;
grant execute on function public.report_player(text, bigint, uuid) to authenticated;
revoke all on function public.admin_player_reports(), public.admin_close_report(bigint, boolean) from public, anon;
grant execute on function public.admin_player_reports(), public.admin_close_report(bigint, boolean) to authenticated;
