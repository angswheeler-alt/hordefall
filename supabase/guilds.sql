-- Hordefall guilds. Paste this into the Supabase SQL editor and run it once,
-- after setup.sql. Running it again is safe (and needed after an update): it
-- adds what is missing and replaces the functions and policies.
--
-- Players can read their own guild's data (and browse the guild list), but
-- every change goes through the functions below, which check the rules:
-- up to 30 members, one leader, officers, one medal request per 8 hours and
-- at most 5 medals from each guildmate per request.

create table if not exists public.guilds (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 24),
  description text not null default '' check (char_length(description) <= 140),
  min_stage integer not null default 0 check (min_stage >= 0),
  created_at timestamptz not null default now()
);
create unique index if not exists guilds_name_key on public.guilds (lower(name));

create table if not exists public.guild_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  guild_id uuid not null references public.guilds (id) on delete cascade,
  username text not null,
  role text not null check (role in ('leader', 'officer', 'member')),
  best_stage integer not null default 1,
  joined_at timestamptz not null default now()
);
create index if not exists guild_members_guild on public.guild_members (guild_id);

create table if not exists public.guild_messages (
  id bigint generated always as identity primary key,
  guild_id uuid not null references public.guilds (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  username text not null,
  body text not null check (char_length(body) between 1 and 200),
  created_at timestamptz not null default now()
);
create index if not exists guild_messages_guild on public.guild_messages (guild_id, id desc);

create table if not exists public.guild_requests (
  id bigint generated always as identity primary key,
  guild_id uuid not null references public.guilds (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  username text not null,
  hero_id text not null check (char_length(hero_id) between 1 and 40),
  goal integer not null check (goal in (5, 10, 20)),
  received integer not null default 0,
  collected integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists guild_requests_guild on public.guild_requests (guild_id, created_at desc);
create index if not exists guild_requests_user on public.guild_requests (user_id, created_at desc);

create table if not exists public.guild_donations (
  request_id bigint not null references public.guild_requests (id) on delete cascade,
  guild_id uuid not null references public.guilds (id) on delete cascade,
  donor_id uuid not null references auth.users (id) on delete cascade,
  donor_username text not null,
  amount integer not null check (amount > 0),
  created_at timestamptz not null default now()
);
create index if not exists guild_donations_request on public.guild_donations (request_id);

-- ---------- reading ----------

create or replace function public.my_guild() returns uuid
language sql stable security definer set search_path = public as $$
  select guild_id from guild_members where user_id = auth.uid()
$$;

alter table public.guilds enable row level security;
alter table public.guild_members enable row level security;
alter table public.guild_messages enable row level security;
alter table public.guild_requests enable row level security;
alter table public.guild_donations enable row level security;

drop policy if exists "Signed-in players browse guilds" on public.guilds;
create policy "Signed-in players browse guilds" on public.guilds for select to authenticated using (true);

drop policy if exists "Signed-in players see guild rosters" on public.guild_members;
create policy "Signed-in players see guild rosters" on public.guild_members for select to authenticated using (true);

drop policy if exists "Members read their guild chat" on public.guild_messages;
create policy "Members read their guild chat" on public.guild_messages for select to authenticated using (guild_id = public.my_guild());

drop policy if exists "Members read their guild requests" on public.guild_requests;
create policy "Members read their guild requests" on public.guild_requests for select to authenticated using (guild_id = public.my_guild());

drop policy if exists "Members read their guild donations" on public.guild_donations;
create policy "Members read their guild donations" on public.guild_donations for select to authenticated using (guild_id = public.my_guild());

-- ---------- changes (all through these functions) ----------

create or replace function public.guild_username() returns text
language sql stable security definer set search_path = public, auth as $$
  select coalesce(raw_user_meta_data ->> 'username', split_part(email, '@', 1), 'player') from auth.users where id = auth.uid()
$$;

create or replace function public.guild_role() returns text
language sql stable security definer set search_path = public as $$
  select role from guild_members where user_id = auth.uid()
$$;

create or replace function public.create_guild(p_name text, p_description text, p_min_stage integer, p_best_stage integer) returns uuid
language plpgsql security definer set search_path = public as $$
declare g uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if public.my_guild() is not null then raise exception 'Leave your guild first.'; end if;
  p_name := btrim(p_name);
  if char_length(p_name) not between 3 and 24 then raise exception 'Guild names are 3-24 characters.'; end if;
  if exists (select 1 from guilds where lower(name) = lower(p_name)) then raise exception 'That guild name is taken.'; end if;
  insert into guilds (name, description, min_stage) values (p_name, left(btrim(coalesce(p_description, '')), 140), greatest(0, coalesce(p_min_stage, 0)))
    returning id into g;
  insert into guild_members (user_id, guild_id, username, role, best_stage)
    values (auth.uid(), g, public.guild_username(), 'leader', greatest(1, coalesce(p_best_stage, 1)));
  return g;
end $$;

create or replace function public.join_guild(p_guild uuid, p_best_stage integer) returns void
language plpgsql security definer set search_path = public as $$
declare need integer;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if public.my_guild() is not null then raise exception 'Leave your guild first.'; end if;
  select min_stage into need from guilds where id = p_guild for update;
  if not found then raise exception 'That guild no longer exists.'; end if;
  if coalesce(p_best_stage, 1) < need then raise exception 'This guild needs stage %.', need; end if;
  if (select count(*) from guild_members where guild_id = p_guild) >= 30 then raise exception 'That guild is full.'; end if;
  insert into guild_members (user_id, guild_id, username, role, best_stage)
    values (auth.uid(), p_guild, public.guild_username(), 'member', greatest(1, coalesce(p_best_stage, 1)));
end $$;

create or replace function public.leave_guild() returns void
language plpgsql security definer set search_path = public as $$
declare g uuid := public.my_guild(); was text := public.guild_role(); heir uuid;
begin
  if g is null then return; end if;
  delete from guild_requests where user_id = auth.uid() and guild_id = g;
  delete from guild_members where user_id = auth.uid();
  if was = 'leader' then
    select user_id into heir from guild_members where guild_id = g
      order by (role = 'officer') desc, joined_at limit 1;
    if heir is null then delete from guilds where id = g;
    else update guild_members set role = 'leader' where user_id = heir;
    end if;
  end if;
end $$;

-- Leader: make someone officer or member, or hand over leadership ('leader').
create or replace function public.set_guild_role(p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
declare g uuid := public.my_guild();
begin
  if public.guild_role() is distinct from 'leader' then raise exception 'Only the leader can change ranks.'; end if;
  if p_user = auth.uid() then raise exception 'Pick another member.'; end if;
  if p_role not in ('leader', 'officer', 'member') then raise exception 'Unknown rank.'; end if;
  if not exists (select 1 from guild_members where user_id = p_user and guild_id = g) then raise exception 'They are not in your guild.'; end if;
  if p_role = 'leader' then update guild_members set role = 'officer' where user_id = auth.uid(); end if;
  update guild_members set role = p_role where user_id = p_user;
end $$;

-- Leader removes anyone; officers remove members.
create or replace function public.kick_guild_member(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare g uuid := public.my_guild(); mine text := public.guild_role(); theirs text;
begin
  select role into theirs from guild_members where user_id = p_user and guild_id = g;
  if theirs is null or p_user = auth.uid() then raise exception 'They are not in your guild.'; end if;
  if not (mine = 'leader' or (mine = 'officer' and theirs = 'member')) then raise exception 'Your rank can''t remove them.'; end if;
  delete from guild_requests where user_id = p_user and guild_id = g;
  delete from guild_members where user_id = p_user;
end $$;

create or replace function public.update_guild(p_description text, p_min_stage integer) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.guild_role() not in ('leader', 'officer') then raise exception 'Only the leader and officers can edit the guild.'; end if;
  update guilds set description = left(btrim(coalesce(p_description, '')), 140), min_stage = greatest(0, coalesce(p_min_stage, 0))
    where id = public.my_guild();
end $$;

-- Keeps the roster's stage and name current; called when the Guild tab opens.
create or replace function public.touch_guild_member(p_best_stage integer) returns void
language sql security definer set search_path = public as $$
  update guild_members set best_stage = greatest(best_stage, coalesce(p_best_stage, 1)), username = public.guild_username()
    where user_id = auth.uid()
$$;

create or replace function public.post_guild_message(p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare g uuid := public.my_guild();
begin
  if g is null then raise exception 'Join a guild first.'; end if;
  p_body := left(btrim(p_body), 200);
  if p_body = '' then return; end if;
  if exists (select 1 from guild_messages where user_id = auth.uid() and created_at > now() - interval '2 seconds') then
    raise exception 'Slow down a little.';
  end if;
  insert into guild_messages (guild_id, user_id, username, body) values (g, auth.uid(), public.guild_username(), p_body);
  -- Keep the newest 200 messages per guild.
  delete from guild_messages where guild_id = g and id < (
    select id from guild_messages where guild_id = g order by id desc offset 199 limit 1);
end $$;

-- Ask guildmates for a hero's medals: one request per 8 hours. The game sends
-- the goal for the hero's rarity (Common 20, Rare 10, Epic 5).
create or replace function public.request_guild_medals(p_hero text, p_goal integer) returns bigint
language plpgsql security definer set search_path = public as $$
declare g uuid := public.my_guild(); r bigint;
begin
  if g is null then raise exception 'Join a guild first.'; end if;
  if p_goal not in (5, 10, 20) then raise exception 'Unknown request size.'; end if;
  if exists (select 1 from guild_requests where user_id = auth.uid() and created_at > now() - interval '8 hours') then
    raise exception 'You can ask again 8 hours after your last request.';
  end if;
  insert into guild_requests (guild_id, user_id, username, hero_id, goal) values (g, auth.uid(), public.guild_username(), p_hero, p_goal)
    returning id into r;
  return r;
end $$;

-- Give medals to a guildmate's open request (open for 24 hours, until full).
-- At most 5 from each guildmate per request. Returns how many were taken, so
-- the game only removes those from the donor's save.
create or replace function public.donate_guild_medals(p_request bigint, p_amount integer) returns integer
language plpgsql security definer set search_path = public as $$
declare g uuid := public.my_guild(); req guild_requests; given integer; take integer;
begin
  select * into req from guild_requests where id = p_request for update;
  if not found or req.guild_id is distinct from g then raise exception 'That request is gone.'; end if;
  if req.user_id = auth.uid() then raise exception 'You can''t fill your own request.'; end if;
  if req.created_at < now() - interval '24 hours' then raise exception 'That request has closed.'; end if;
  select coalesce(sum(amount), 0) into given from guild_donations where request_id = p_request and donor_id = auth.uid();
  take := least(greatest(coalesce(p_amount, 0), 0), 5 - given, req.goal - req.received);
  if take <= 0 then return 0; end if;
  update guild_requests set received = received + take where id = p_request;
  insert into guild_donations (request_id, guild_id, donor_id, donor_username, amount) values (p_request, g, auth.uid(), public.guild_username(), take);
  return take;
end $$;

-- Hand over the medals guildmates gave since the last collect.
create or replace function public.collect_guild_medals() returns table (hero_id text, amount integer)
language plpgsql security definer set search_path = public as $$
begin
  return query
    update guild_requests r set collected = r.received
    from (select id, received - collected as diff from guild_requests where user_id = auth.uid() and received > collected for update) d
    where r.id = d.id
    returning r.hero_id, d.diff;
end $$;

-- ---------- Guild Boss ----------
-- One boss per guild per day (UTC). Every member gets 3 attempts a day and
-- their damage fills a shared health bar. A boss killed today comes back one
-- level higher tomorrow; one that survives comes back at the same level.

create table if not exists public.guild_boss_days (
  guild_id uuid not null references public.guilds (id) on delete cascade,
  day date not null,
  level integer not null,
  element text not null,
  hp numeric not null,
  damage numeric not null default 0,
  killed_at timestamptz,
  primary key (guild_id, day)
);

create table if not exists public.guild_boss_hits (
  id bigint generated always as identity primary key,
  guild_id uuid not null references public.guilds (id) on delete cascade,
  day date not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  username text not null,
  damage numeric not null check (damage >= 0),
  created_at timestamptz not null default now()
);
create index if not exists guild_boss_hits_day on public.guild_boss_hits (guild_id, day);
create index if not exists guild_boss_hits_user on public.guild_boss_hits (user_id, day);

create table if not exists public.guild_boss_claims (
  guild_id uuid not null references public.guilds (id) on delete cascade,
  day date not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  primary key (guild_id, day, user_id)
);

alter table public.guild_boss_days enable row level security;
alter table public.guild_boss_hits enable row level security;
alter table public.guild_boss_claims enable row level security;

drop policy if exists "Members read their guild boss" on public.guild_boss_days;
create policy "Members read their guild boss" on public.guild_boss_days for select to authenticated using (guild_id = public.my_guild());
drop policy if exists "Members read their guild boss hits" on public.guild_boss_hits;
create policy "Members read their guild boss hits" on public.guild_boss_hits for select to authenticated using (guild_id = public.my_guild());
drop policy if exists "Players read their own boss claims" on public.guild_boss_claims;
create policy "Players read their own boss claims" on public.guild_boss_claims for select to authenticated using (user_id = auth.uid());

-- Boss health for a level: about 15 attempts by a team of five 1-star heroes
-- at Ember level 30 x level (src/guild.ts mirrors this as guildBossHp).
create or replace function public.guild_boss_hp(p_level integer) returns numeric
language sql immutable as $$
  select round(14400 * (30 * p_level) * power(2::numeric, 1.5 * p_level))
$$;

-- Today's boss for the caller's guild, made on the first look of the day.
create or replace function public.guild_boss_today() returns public.guild_boss_days
language plpgsql security definer set search_path = public as $$
declare g uuid := public.my_guild(); today date := (now() at time zone 'utc')::date; row guild_boss_days; prev guild_boss_days; lvl integer;
begin
  if g is null then raise exception 'Join a guild first.'; end if;
  select * into row from guild_boss_days where guild_id = g and day = today;
  if found then return row; end if;
  select * into prev from guild_boss_days where guild_id = g order by day desc limit 1;
  lvl := case when prev.guild_id is null then 1 when prev.killed_at is not null then prev.level + 1 else prev.level end;
  insert into guild_boss_days (guild_id, day, level, element, hp)
    values (g, today, lvl, (array['water', 'fire', 'earth', 'light', 'dark'])[1 + ((today - date '2026-01-01') % 5)], public.guild_boss_hp(lvl))
    on conflict (guild_id, day) do nothing;
  select * into row from guild_boss_days where guild_id = g and day = today;
  return row;
end $$;

-- One attempt (hit_guild_boss) is defined in the research section below, since it also feeds research.

-- The kill reward, once per beaten boss for every member who hit it (up to 7 days back).
-- Returns the boss level, or null when there is nothing to claim.
create or replace function public.claim_guild_boss(p_day date) returns integer
language plpgsql security definer set search_path = public as $$
declare g uuid := public.my_guild(); lvl integer;
begin
  select level into lvl from guild_boss_days
    where guild_id = g and day = p_day and killed_at is not null and day > (now() at time zone 'utc')::date - 7;
  if lvl is null then return null; end if;
  if not exists (select 1 from guild_boss_hits where guild_id = g and day = p_day and user_id = auth.uid()) then return null; end if;
  insert into guild_boss_claims (guild_id, day, user_id) values (g, p_day, auth.uid()) on conflict do nothing;
  if not found then return null; end if;
  return lvl;
end $$;

-- ---------- Guild Research ----------
-- Shared bonuses every member gets. Members put Guild Coins into a branch, and
-- every Guild Boss attempt adds 10 + boss level points to the guild's focus
-- branch. 10 ranks per branch; rank r costs 300 x r^2 points (115,500 in all).

alter table public.guilds add column if not exists research_focus text not null default 'combat';

create table if not exists public.guild_research (
  guild_id uuid not null references public.guilds (id) on delete cascade,
  branch text not null check (branch in ('prosperity', 'combat', 'exploration', 'elemental')),
  points bigint not null default 0,
  primary key (guild_id, branch)
);
alter table public.guild_research enable row level security;
drop policy if exists "Members read their guild research" on public.guild_research;
create policy "Members read their guild research" on public.guild_research for select to authenticated using (guild_id = public.my_guild());

-- Adds up to p_amount points (capped at the last rank). Returns how many were taken.
create or replace function public.add_guild_research(p_guild uuid, p_branch text, p_amount bigint) returns bigint
language plpgsql security definer set search_path = public as $$
declare have bigint; take bigint;
begin
  if p_branch not in ('prosperity', 'combat', 'exploration', 'elemental') then raise exception 'Unknown research branch.'; end if;
  insert into guild_research (guild_id, branch) values (p_guild, p_branch) on conflict do nothing;
  select points into have from guild_research where guild_id = p_guild and branch = p_branch for update;
  take := least(greatest(coalesce(p_amount, 0), 0), 115500 - have);
  if take > 0 then update guild_research set points = points + take where guild_id = p_guild and branch = p_branch; end if;
  return greatest(take, 0);
end $$;

create or replace function public.contribute_guild_research(p_branch text, p_amount integer) returns bigint
language plpgsql security definer set search_path = public as $$
declare g uuid := public.my_guild();
begin
  if g is null then raise exception 'Join a guild first.'; end if;
  if p_amount not between 1 and 100000 then raise exception 'Pick an amount from 1 to 100,000.'; end if;
  return public.add_guild_research(g, p_branch, p_amount);
end $$;

create or replace function public.set_guild_research_focus(p_branch text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.guild_role() not in ('leader', 'officer') then raise exception 'Only the leader and officers can pick the focus.'; end if;
  if p_branch not in ('prosperity', 'combat', 'exploration', 'elemental') then raise exception 'Unknown research branch.'; end if;
  update guilds set research_focus = p_branch where id = public.my_guild();
end $$;

-- Boss attempts feed the focus branch.
create or replace function public.hit_guild_boss(p_damage numeric) returns json
language plpgsql security definer set search_path = public as $$
declare boss guild_boss_days; used integer; dmg numeric; killed boolean := false; focus text;
begin
  boss := public.guild_boss_today();
  select * into boss from guild_boss_days where guild_id = boss.guild_id and day = boss.day for update;
  if boss.killed_at is not null then raise exception 'Today''s boss is already beaten. A stronger one comes tomorrow.'; end if;
  select count(*) into used from guild_boss_hits where user_id = auth.uid() and day = boss.day;
  if used >= 3 then raise exception 'No attempts left today.'; end if;
  dmg := greatest(0, coalesce(p_damage, 0));
  insert into guild_boss_hits (guild_id, day, user_id, username, damage) values (boss.guild_id, boss.day, auth.uid(), public.guild_username(), dmg);
  update guild_boss_days set damage = least(hp, damage + dmg),
    killed_at = case when damage + dmg >= hp then now() else null end
    where guild_id = boss.guild_id and day = boss.day
    returning * into boss;
  killed := boss.killed_at is not null;
  select research_focus into focus from guilds where id = boss.guild_id;
  perform public.add_guild_research(boss.guild_id, focus, 10 + boss.level);
  return json_build_object('attempt', used + 1, 'level', boss.level, 'hp', boss.hp, 'damage', boss.damage, 'killed', killed, 'research', 10 + boss.level, 'focus', focus);
end $$;

-- ---------- Guild Quests ----------
-- Weekly (Monday 00:00 UTC) shared goals: defeat enemies, clear stages, win Trials and
-- Guild Boss attempts. Goals scale with members (at least 5). The game reports its counts;
-- boss attempts come from guild_boss_hits. Each member's weekly count per quest is capped at
-- 5 x the per-member goal. Rewards: a shared track at 25/50/75/100% (for members who helped
-- this week) and a small personal reward per quest. The game pays them when a claim succeeds.

create table if not exists public.guild_quest_progress (
  guild_id uuid not null references public.guilds (id) on delete cascade,
  week date not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  username text not null,
  kills bigint not null default 0,
  stages bigint not null default 0,
  trials bigint not null default 0,
  primary key (guild_id, week, user_id)
);
alter table public.guild_quest_progress enable row level security;
drop policy if exists "Members read their guild quests" on public.guild_quest_progress;
create policy "Members read their guild quests" on public.guild_quest_progress for select to authenticated using (guild_id = public.my_guild());

create table if not exists public.guild_quest_claims (
  guild_id uuid not null references public.guilds (id) on delete cascade,
  week date not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  reward text not null,
  primary key (guild_id, week, user_id, reward)
);
alter table public.guild_quest_claims enable row level security;
drop policy if exists "Players read their quest claims" on public.guild_quest_claims;
create policy "Players read their quest claims" on public.guild_quest_claims for select to authenticated using (user_id = auth.uid());

create or replace function public.guild_quest_week() returns date
language sql stable as $$ select date_trunc('week', now() at time zone 'utc')::date $$;

-- Per-member goals (matches GUILD_QUESTS in src/data.ts): the guild goal is this x max(5, members),
-- the personal reward needs half of it.
create or replace function public.guild_quest_goal(p_kind text) returns bigint
language sql immutable as $$
  select case p_kind when 'kills' then 2000 when 'stages' then 150 when 'trials' then 10 when 'boss' then 12 end
$$;

-- This week's quests for the player's guild: goal, guild progress and the player's own share.
create or replace function public.guild_quests() returns json
language plpgsql security definer set search_path = public as $$
declare g uuid := public.my_guild(); wk date := public.guild_quest_week(); n integer; result json;
begin
  if g is null then raise exception 'Join a guild first.'; end if;
  select greatest(5, count(*)) into n from guild_members where guild_id = g;
  with prog as (
    select 'kills' kind, coalesce(sum(kills), 0) total, coalesce(sum(kills) filter (where user_id = auth.uid()), 0) mine from guild_quest_progress where guild_id = g and week = wk
    union all select 'stages', coalesce(sum(stages), 0), coalesce(sum(stages) filter (where user_id = auth.uid()), 0) from guild_quest_progress where guild_id = g and week = wk
    union all select 'trials', coalesce(sum(trials), 0), coalesce(sum(trials) filter (where user_id = auth.uid()), 0) from guild_quest_progress where guild_id = g and week = wk
    union all select 'boss', count(*), count(*) filter (where user_id = auth.uid()) from guild_boss_hits where guild_id = g and day >= wk and day < wk + 7
  )
  select json_build_object(
    'week', wk,
    'members', n,
    'quests', (select json_agg(json_build_object('kind', kind, 'goal', public.guild_quest_goal(kind) * n, 'progress', total, 'mine', mine, 'personal', public.guild_quest_goal(kind) / 2)) from prog),
    'claimed', (select coalesce(json_agg(reward), '[]'::json) from guild_quest_claims where guild_id = g and week = wk and user_id = auth.uid())
  ) into result;
  return result;
end $$;

-- The game reports what it counted since the last report.
create or replace function public.report_guild_quests(p_kills integer, p_stages integer, p_trials integer) returns void
language plpgsql security definer set search_path = public as $$
declare g uuid := public.my_guild(); wk date := public.guild_quest_week();
begin
  if g is null then return; end if;
  insert into guild_quest_progress (guild_id, week, user_id, username) values (g, wk, auth.uid(), public.guild_username()) on conflict do nothing;
  update guild_quest_progress set
    kills = least(kills + greatest(coalesce(p_kills, 0), 0), 5 * public.guild_quest_goal('kills')),
    stages = least(stages + greatest(coalesce(p_stages, 0), 0), 5 * public.guild_quest_goal('stages')),
    trials = least(trials + greatest(coalesce(p_trials, 0), 0), 5 * public.guild_quest_goal('trials'))
    where guild_id = g and week = wk and user_id = auth.uid();
end $$;

-- Claim a reward this week: 'track1'..'track4' (25% steps of the guild's average completion,
-- for members who helped) or a quest kind for its personal reward. True when newly claimed.
create or replace function public.claim_guild_quest(p_reward text) returns boolean
language plpgsql security definer set search_path = public as $$
declare g uuid := public.my_guild(); wk date := public.guild_quest_week(); q json; pct numeric := 0; helped boolean := false; item json; tier integer;
begin
  if g is null then raise exception 'Join a guild first.'; end if;
  q := public.guild_quests();
  for item in select * from json_array_elements(q -> 'quests') loop
    pct := pct + least(1, (item ->> 'progress')::numeric / (item ->> 'goal')::numeric) / 4;
    if (item ->> 'mine')::numeric > 0 then helped := true; end if;
    if item ->> 'kind' = p_reward and (item ->> 'mine')::numeric < (item ->> 'personal')::numeric then
      raise exception 'Do your part of that quest first.';
    end if;
  end loop;
  if p_reward in ('track1', 'track2', 'track3', 'track4') then
    tier := substr(p_reward, 6)::integer;
    if pct < tier * 0.25 then raise exception 'The guild hasn''t reached that step yet.'; end if;
    if not helped then raise exception 'Help with a quest this week to claim guild rewards.'; end if;
  elsif p_reward not in ('kills', 'stages', 'trials', 'boss') then
    raise exception 'Unknown reward.';
  end if;
  insert into guild_quest_claims (guild_id, week, user_id, reward) values (g, wk, auth.uid(), p_reward) on conflict do nothing;
  return found;
end $$;

revoke all on function public.my_guild(), public.guild_username(), public.guild_role(),
  public.create_guild(text, text, integer, integer), public.join_guild(uuid, integer), public.leave_guild(),
  public.set_guild_role(uuid, text), public.kick_guild_member(uuid), public.update_guild(text, integer),
  public.touch_guild_member(integer), public.post_guild_message(text), public.request_guild_medals(text, integer),
  public.donate_guild_medals(bigint, integer), public.collect_guild_medals(),
  public.guild_boss_today(), public.hit_guild_boss(numeric), public.claim_guild_boss(date),
  public.add_guild_research(uuid, text, bigint), public.contribute_guild_research(text, integer), public.set_guild_research_focus(text),
  public.guild_quests(), public.report_guild_quests(integer, integer, integer), public.claim_guild_quest(text) from public, anon;
grant execute on function public.my_guild(), public.guild_username(), public.guild_role(),
  public.create_guild(text, text, integer, integer), public.join_guild(uuid, integer), public.leave_guild(),
  public.set_guild_role(uuid, text), public.kick_guild_member(uuid), public.update_guild(text, integer),
  public.touch_guild_member(integer), public.post_guild_message(text), public.request_guild_medals(text, integer),
  public.donate_guild_medals(bigint, integer), public.collect_guild_medals(),
  public.guild_boss_today(), public.hit_guild_boss(numeric), public.claim_guild_boss(date),
  public.contribute_guild_research(text, integer), public.set_guild_research_focus(text),
  public.guild_quests(), public.report_guild_quests(integer, integer, integer), public.claim_guild_quest(text) to authenticated;
