-- Hordefall save backups and the admin recovery tool. Paste this into the
-- Supabase SQL editor and run it once, after setup.sql. Running it again is
-- safe: it adds what is missing and replaces the functions.
--
-- Every time a cloud save changes, the version it replaces is kept in
-- save_backups when the last backup is over an hour old, or right away when
-- the new version has a lower best stage or fewer Rekindles (a reset or a
-- lost save). The newest 50 backups per player are kept.
--
-- Admins (people listed in public.save_admins) can search players, look at a
-- player's save and backups, and restore one through the admin page
-- (admin.html next to the game). To make yourself an admin, run once:
--   insert into public.save_admins (user_id)
--   select id from auth.users where email = 'YOUR_USERNAME@players.hordefall.invalid'
--   on conflict do nothing;

create table if not exists public.save_admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.save_admins enable row level security;
-- No policies: players can't read or change the admin list; the functions below can.

create table if not exists public.save_backups (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  best_stage integer not null default 1,
  saved_at timestamptz not null default now(),
  reason text not null default 'hourly'
);
create index if not exists save_backups_user on public.save_backups (user_id, saved_at desc);
alter table public.save_backups enable row level security;
-- No policies: backups are only reachable through the admin functions.

-- A number from a save field, or the fallback when it is missing or not a number.
create or replace function public.save_num(d jsonb, key text, fallback integer)
returns integer language sql immutable as $$
  select case when jsonb_typeof(d -> key) = 'number' then floor((d ->> key)::numeric)::integer
              when (d ->> key) ~ '^[0-9]+$' then (d ->> key)::integer
              else fallback end
$$;

create or replace function public.backup_save_before_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  last_at timestamptz;
  went_back boolean;
begin
  if old.data is not distinct from new.data or current_setting('hordefall.restoring', true) = '1' then
    return new;
  end if;
  went_back := save_num(new.data, 'bestStage', save_num(new.data, 'stage', 1)) < save_num(old.data, 'bestStage', save_num(old.data, 'stage', 1))
            or save_num(new.data, 'rekindles', 0) < save_num(old.data, 'rekindles', 0);
  select max(saved_at) into last_at from save_backups where user_id = old.user_id;
  if went_back or last_at is null or last_at < now() - interval '1 hour' then
    insert into save_backups (user_id, data, best_stage, saved_at, reason)
    values (old.user_id, old.data, old.best_stage, old.updated_at, case when went_back then 'before progress went down' else 'hourly' end);
    delete from save_backups b where b.user_id = old.user_id and b.id not in (
      select id from save_backups where user_id = old.user_id order by saved_at desc, id desc limit 50);
  end if;
  return new;
end $$;

drop trigger if exists saves_backup on public.saves;
create trigger saves_backup before update on public.saves
  for each row execute function public.backup_save_before_change();

create or replace function public.is_save_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from save_admins where user_id = auth.uid())
$$;

create or replace function public.require_save_admin()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not is_save_admin() then
    raise exception 'Admins only.';
  end if;
end $$;

-- Players whose username contains the search text (newest saves first).
create or replace function public.admin_find_players(p_query text)
returns table (user_id uuid, username text, best_stage integer, updated_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  perform require_save_admin();
  return query
    select u.id, coalesce(u.raw_user_meta_data ->> 'username', split_part(u.email, '@', 1)), s.best_stage, s.updated_at
    from auth.users u left join saves s on s.user_id = u.id
    where coalesce(u.raw_user_meta_data ->> 'username', split_part(u.email, '@', 1)) ilike '%' || coalesce(trim(p_query), '') || '%'
    order by s.updated_at desc nulls last
    limit 25;
end $$;

-- A player's current save (id 0) and backups, newest first, without the save data.
create or replace function public.admin_save_versions(p_user uuid)
returns table (id bigint, kind text, best_stage integer, stage integer, rekindles integer, saved_at timestamptz, reason text)
language plpgsql stable security definer set search_path = public as $$
begin
  perform require_save_admin();
  return query
    select 0::bigint, 'current'::text, save_num(s.data, 'bestStage', s.best_stage), save_num(s.data, 'stage', 1), save_num(s.data, 'rekindles', 0), s.updated_at, ''::text
    from saves s where s.user_id = p_user
    union all
    select b.id, 'backup'::text, save_num(b.data, 'bestStage', b.best_stage), save_num(b.data, 'stage', 1), save_num(b.data, 'rekindles', 0), b.saved_at, b.reason
    from save_backups b where b.user_id = p_user
    order by 2 desc, 6 desc;
end $$;

-- The full save of one version (p_backup 0 = the current save).
create or replace function public.admin_save_data(p_user uuid, p_backup bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare d jsonb;
begin
  perform require_save_admin();
  if p_backup = 0 then
    select data into d from saves where user_id = p_user;
  else
    select data into d from save_backups where id = p_backup and user_id = p_user;
  end if;
  if d is null then
    raise exception 'That save is gone.';
  end if;
  return d;
end $$;

-- Put a backup back as the player's cloud save. The current save is backed up
-- first, and the restored one gets a newer revision so the player's devices
-- pick it up (a device with more progress asks the player which to keep).
create or replace function public.admin_restore_save(p_user uuid, p_backup bigint)
returns integer language plpgsql security definer set search_path = public as $$
declare
  b save_backups;
  cur saves;
  rev integer;
  d jsonb;
begin
  perform require_save_admin();
  select * into b from save_backups where id = p_backup and user_id = p_user;
  if b.id is null then
    raise exception 'That backup is gone.';
  end if;
  select * into cur from saves where user_id = p_user for update;
  rev := coalesce(save_num(cur.data, 'rev', 0), 0) + 1;
  d := b.data || jsonb_build_object('rev', rev, 'lastSeen', floor(extract(epoch from now()) * 1000));
  if cur.user_id is null then
    insert into saves (user_id, data, best_stage, updated_at) values (p_user, d, b.best_stage, now());
  else
    insert into save_backups (user_id, data, best_stage, saved_at, reason) values (p_user, cur.data, cur.best_stage, cur.updated_at, 'before admin restore');
    perform set_config('hordefall.restoring', '1', true);
    update saves set data = d, best_stage = b.best_stage, updated_at = now() where user_id = p_user;
    perform set_config('hordefall.restoring', '', true);
  end if;
  return rev;
end $$;

revoke all on function public.backup_save_before_change() from public, anon, authenticated;
revoke all on function public.require_save_admin() from public, anon;
revoke all on function public.admin_find_players(text) from public, anon;
revoke all on function public.admin_save_versions(uuid) from public, anon;
revoke all on function public.admin_save_data(uuid, bigint) from public, anon;
revoke all on function public.admin_restore_save(uuid, bigint) from public, anon;
grant execute on function public.is_save_admin() to authenticated;
grant execute on function public.admin_find_players(text) to authenticated;
grant execute on function public.admin_save_versions(uuid) to authenticated;
grant execute on function public.admin_save_data(uuid, bigint) to authenticated;
grant execute on function public.admin_restore_save(uuid, bigint) to authenticated;
