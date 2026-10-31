-- Hordefall profiles, friends and leaderboards. Paste this into the Supabase
-- SQL editor and run it once, after setup.sql. Running it again is safe: it
-- adds what is missing and replaces the functions.
--
-- Each signed-in player's game reports a small public profile: total Combat
-- Power, best stage, Rekindles and their team. Anyone signed in can see the
-- leaderboards (name, Combat Power, best stage); a player's team is shown
-- only to their friends. Every read and change goes through the functions
-- below, which check the rules (no direct table access).

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  -- Combat Power can outgrow any number type, so it is kept as text and sorted by its log10.
  total_cp text not null default '0',
  cp_log double precision not null default 0,
  best_stage integer not null default 1,
  rekindles integer not null default 0,
  team jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists profiles_cp on public.profiles (cp_log desc, updated_at);
create index if not exists profiles_stage on public.profiles (best_stage desc, updated_at);
alter table public.profiles enable row level security;

-- One row per pair of players (user_a < user_b): a pending request or a friendship.
create table if not exists public.friendships (
  user_a uuid not null references auth.users (id) on delete cascade,
  user_b uuid not null references auth.users (id) on delete cascade,
  requested_by uuid not null references auth.users (id) on delete cascade,
  status text not null check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);
create index if not exists friendships_b on public.friendships (user_b);
alter table public.friendships enable row level security;

create or replace function public.social_username(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(u.raw_user_meta_data ->> 'username', split_part(u.email, '@', 1)) from auth.users u where u.id = p_user
$$;

create or replace function public.social_me()
returns uuid language plpgsql stable as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first.';
  end if;
  return auth.uid();
end $$;

create or replace function public.are_friends(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from friendships where user_a = least(p_a, p_b) and user_b = greatest(p_a, p_b) and status = 'accepted')
$$;

-- The game reports its profile (every minute while signed in, when something changed).
create or replace function public.save_profile(p_total_cp text, p_cp_log double precision, p_best_stage integer, p_rekindles integer, p_team jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := social_me();
begin
  if p_total_cp !~ '^[0-9.e+]{1,40}$' or p_cp_log is null or p_cp_log < 0 or p_cp_log > 1000000 then
    raise exception 'Bad Combat Power.';
  end if;
  if jsonb_typeof(p_team) <> 'array' or jsonb_array_length(p_team) > 5 or length(p_team::text) > 2000 then
    raise exception 'Bad team.';
  end if;
  insert into profiles (user_id, username, total_cp, cp_log, best_stage, rekindles, team, updated_at)
  values (me, social_username(me), p_total_cp, p_cp_log, greatest(1, coalesce(p_best_stage, 1)), greatest(0, coalesce(p_rekindles, 0)), p_team, now())
  on conflict (user_id) do update set username = excluded.username, total_cp = excluded.total_cp, cp_log = excluded.cp_log,
    best_stage = excluded.best_stage, rekindles = excluded.rekindles, team = excluded.team, updated_at = now();
end $$;

-- Ask a player (by username) to be friends. If they already asked you, you become friends.
create or replace function public.send_friend_request(p_username text)
returns text language plpgsql security definer set search_path = public as $$
declare
  me uuid := social_me();
  them uuid;
  f friendships;
begin
  select id into them from auth.users
  where lower(coalesce(raw_user_meta_data ->> 'username', split_part(email, '@', 1))) = lower(trim(p_username)) limit 1;
  if them is null then
    raise exception 'No player is called that.';
  end if;
  if them = me then
    raise exception 'That''s you!';
  end if;
  select * into f from friendships where user_a = least(me, them) and user_b = greatest(me, them);
  if f.status = 'accepted' then
    raise exception 'You are already friends.';
  end if;
  if f.status = 'pending' and f.requested_by = them then
    update friendships set status = 'accepted' where user_a = f.user_a and user_b = f.user_b;
    return 'friends';
  end if;
  if f.status = 'pending' then
    raise exception 'You already asked. Waiting for them to answer.';
  end if;
  if (select count(*) from friendships where (user_a = me or user_b = me) and status = 'accepted') >= 100 then
    raise exception 'You can have up to 100 friends.';
  end if;
  if (select count(*) from friendships where requested_by = me and status = 'pending') >= 30 then
    raise exception 'Too many requests waiting. Wait for some answers first.';
  end if;
  insert into friendships (user_a, user_b, requested_by, status) values (least(me, them), greatest(me, them), me, 'pending');
  return 'sent';
end $$;

create or replace function public.answer_friend_request(p_user uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := social_me();
begin
  if p_accept then
    update friendships set status = 'accepted'
    where user_a = least(me, p_user) and user_b = greatest(me, p_user) and status = 'pending' and requested_by = p_user;
    if not found then
      raise exception 'That request is gone.';
    end if;
  else
    delete from friendships where user_a = least(me, p_user) and user_b = greatest(me, p_user) and status = 'pending' and requested_by = p_user;
  end if;
end $$;

-- Unfriend, or take back a request you sent.
create or replace function public.remove_friend(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := social_me();
begin
  delete from friendships where user_a = least(me, p_user) and user_b = greatest(me, p_user)
    and (status = 'accepted' or requested_by = me);
end $$;

-- Friends and requests, friends by Combat Power first.
create or replace function public.my_friends()
returns table (user_id uuid, username text, status text, total_cp text, cp_log double precision, best_stage integer, updated_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare me uuid := social_me();
begin
  return query
    select o.id, coalesce(p.username, social_username(o.id)),
      case when f.status = 'accepted' then 'friend' when f.requested_by = me then 'outgoing' else 'incoming' end,
      coalesce(p.total_cp, '0'), coalesce(p.cp_log, 0), coalesce(p.best_stage, 1), p.updated_at
    from friendships f
    cross join lateral (select case when f.user_a = me then f.user_b else f.user_a end as id) o
    left join profiles p on p.user_id = o.id
    where f.user_a = me or f.user_b = me
    order by (f.status = 'accepted') desc, coalesce(p.cp_log, 0) desc;
end $$;

-- A player's full profile (with their team): yours, or a friend's.
create or replace function public.get_profile(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := social_me();
  p profiles;
begin
  if p_user <> me and not are_friends(me, p_user) then
    raise exception 'Only friends can see this profile.';
  end if;
  select * into p from profiles where user_id = p_user;
  if p.user_id is null then
    return jsonb_build_object('user_id', p_user, 'username', social_username(p_user), 'total_cp', '0', 'best_stage', 1, 'rekindles', 0, 'team', '[]'::jsonb, 'updated_at', null);
  end if;
  return jsonb_build_object('user_id', p.user_id, 'username', p.username, 'total_cp', p.total_cp, 'best_stage', p.best_stage,
    'rekindles', p.rekindles, 'team', p.team, 'updated_at', p.updated_at);
end $$;

-- Top players by total Combat Power ('cp') or best stage ('stage'), plus the caller's own row and rank.
create or replace function public.leaderboard(p_kind text, p_limit integer default 50)
returns table (rank bigint, user_id uuid, username text, total_cp text, best_stage integer, is_me boolean, is_friend boolean)
language plpgsql stable security definer set search_path = public as $$
declare me uuid := social_me();
begin
  if p_kind not in ('cp', 'stage') then
    raise exception 'Unknown leaderboard.';
  end if;
  return query
    with ranked as (
      select p.*, row_number() over (order by case when p_kind = 'cp' then p.cp_log else p.best_stage end desc, p.updated_at) as rk
      from profiles p
    )
    select r.rk, r.user_id, r.username, r.total_cp, r.best_stage, r.user_id = me, are_friends(me, r.user_id)
    from ranked r
    where r.rk <= least(greatest(coalesce(p_limit, 50), 1), 100) or r.user_id = me
    order by r.rk;
end $$;

revoke all on function public.social_me() from public, anon;
revoke all on function public.social_username(uuid) from public, anon, authenticated;
revoke all on function public.are_friends(uuid, uuid) from public, anon, authenticated;
revoke all on function public.save_profile(text, double precision, integer, integer, jsonb) from public, anon;
revoke all on function public.send_friend_request(text) from public, anon;
revoke all on function public.answer_friend_request(uuid, boolean) from public, anon;
revoke all on function public.remove_friend(uuid) from public, anon;
revoke all on function public.my_friends() from public, anon;
revoke all on function public.get_profile(uuid) from public, anon;
revoke all on function public.leaderboard(text, integer) from public, anon;
grant execute on function public.social_me() to authenticated;
grant execute on function public.save_profile(text, double precision, integer, integer, jsonb) to authenticated;
grant execute on function public.send_friend_request(text) to authenticated;
grant execute on function public.answer_friend_request(uuid, boolean) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.my_friends() to authenticated;
grant execute on function public.get_profile(uuid) to authenticated;
grant execute on function public.leaderboard(text, integer) to authenticated;
