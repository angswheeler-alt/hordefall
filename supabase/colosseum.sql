-- Hordefall Colosseum (PvP). Paste this into the Supabase SQL editor and run it
-- once, after setup.sql. Running it again is safe: it adds what is missing and
-- replaces the functions.
--
-- Each signed-in player's game uploads its Colosseum defense team: each hero's
-- permanent stats (Ember levels, stars, pink stars, relics; no gold levels),
-- the team's Combat Power and the player's trophies. Other players in the same
-- rank fight that copy, so nobody has to be online. When a rank has nobody
-- near the attacker's power, the game fills in with Ghost (bot) teams itself.
-- Every read and change goes through the functions below (no direct table access).

create table if not exists public.colosseum_teams (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  trophies integer not null default 0,
  -- Combat Power can outgrow any number type, so it is kept as text and matched by its log10.
  team_cp text not null default '0',
  cp_log double precision not null default 0,
  team jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists colosseum_teams_rank on public.colosseum_teams (trophies, cp_log);
alter table public.colosseum_teams enable row level security;

-- What happened to each player's defense team while they were away.
create table if not exists public.colosseum_log (
  id bigserial primary key,
  defender uuid not null references auth.users (id) on delete cascade,
  attacker uuid not null references auth.users (id) on delete cascade,
  attacker_name text not null,
  attacker_won boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists colosseum_log_defender on public.colosseum_log (defender, created_at desc);
alter table public.colosseum_log enable row level security;

create or replace function public.colosseum_me()
returns uuid language plpgsql stable as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first.';
  end if;
  return auth.uid();
end $$;

create or replace function public.colosseum_username(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(u.raw_user_meta_data ->> 'username', split_part(u.email, '@', 1)) from auth.users u where u.id = p_user
$$;

-- The game uploads its defense team when it changes (and now and then anyway).
create or replace function public.save_colosseum_team(p_trophies integer, p_team_cp text, p_cp_log double precision, p_team jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := colosseum_me();
begin
  if p_team_cp !~ '^[0-9.e+]{1,40}$' or p_cp_log is null or p_cp_log < 0 or p_cp_log > 1000000 then
    raise exception 'Bad Combat Power.';
  end if;
  if jsonb_typeof(p_team) <> 'array' or jsonb_array_length(p_team) < 1 or jsonb_array_length(p_team) > 10 or length(p_team::text) > 8000 then
    raise exception 'Bad team.';
  end if;
  insert into colosseum_teams (user_id, username, trophies, team_cp, cp_log, team, updated_at)
  values (me, colosseum_username(me), greatest(0, least(coalesce(p_trophies, 0), 100000)), p_team_cp, p_cp_log, p_team, now())
  on conflict (user_id) do update set username = excluded.username, trophies = excluded.trophies, team_cp = excluded.team_cp,
    cp_log = excluded.cp_log, team = excluded.team, updated_at = now();
end $$;

-- Up to 12 other players whose trophies sit in [p_min, p_max) (the attacker's rank), closest in
-- power first, active in the last 14 days.
create or replace function public.colosseum_opponents(p_min integer, p_max integer, p_cp_log double precision)
returns table (user_id uuid, username text, trophies integer, team_cp text, cp_log double precision, team jsonb)
language sql stable security definer set search_path = public as $$
  select t.user_id, t.username, t.trophies, t.team_cp, t.cp_log, t.team
  from colosseum_teams t
  where t.user_id <> colosseum_me()
    and t.trophies >= coalesce(p_min, 0) and t.trophies < coalesce(p_max, 1000000)
    and t.updated_at > now() - interval '14 days'
  order by abs(t.cp_log - coalesce(p_cp_log, 0)), t.updated_at desc
  limit 12
$$;

-- The attacker reports how a fight against a real player went, for the defender's log
-- (at most one entry per attacker and defender a minute).
create or replace function public.report_colosseum_fight(p_defender uuid, p_attacker_won boolean)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := colosseum_me();
begin
  if p_defender = me or not exists (select 1 from colosseum_teams where user_id = p_defender) then
    return;
  end if;
  if exists (select 1 from colosseum_log where defender = p_defender and attacker = me and created_at > now() - interval '1 minute') then
    return;
  end if;
  insert into colosseum_log (defender, attacker, attacker_name, attacker_won) values (p_defender, me, colosseum_username(me), coalesce(p_attacker_won, false));
  delete from colosseum_log where defender = p_defender and id not in (select id from colosseum_log where defender = p_defender order by created_at desc limit 30);
end $$;

-- The last 20 fights against this player's defense team.
create or replace function public.my_colosseum_log()
returns table (attacker_name text, attacker_won boolean, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select l.attacker_name, l.attacker_won, l.created_at from colosseum_log l where l.defender = colosseum_me() order by l.created_at desc limit 20
$$;

-- Top 50 real players by trophies.
create or replace function public.colosseum_board()
returns table (rank bigint, username text, trophies integer, team_cp text, is_me boolean)
language sql stable security definer set search_path = public as $$
  select row_number() over (order by t.trophies desc, t.updated_at), t.username, t.trophies, t.team_cp, t.user_id = colosseum_me()
  from colosseum_teams t
  where t.updated_at > now() - interval '14 days'
  order by t.trophies desc, t.updated_at
  limit 50
$$;

revoke all on function public.colosseum_me() from public, anon;
revoke all on function public.colosseum_username(uuid) from public, anon, authenticated;
revoke all on function public.save_colosseum_team(integer, text, double precision, jsonb) from public, anon;
revoke all on function public.colosseum_opponents(integer, integer, double precision) from public, anon;
revoke all on function public.report_colosseum_fight(uuid, boolean) from public, anon;
revoke all on function public.my_colosseum_log() from public, anon;
revoke all on function public.colosseum_board() from public, anon;
