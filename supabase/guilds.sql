-- Hordefall guilds. Paste this into the Supabase SQL editor and run it once,
-- after setup.sql. Running it again is safe: it only replaces the functions
-- and policies.
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

revoke all on function public.my_guild(), public.guild_username(), public.guild_role(),
  public.create_guild(text, text, integer, integer), public.join_guild(uuid, integer), public.leave_guild(),
  public.set_guild_role(uuid, text), public.kick_guild_member(uuid), public.update_guild(text, integer),
  public.touch_guild_member(integer), public.post_guild_message(text), public.request_guild_medals(text, integer),
  public.donate_guild_medals(bigint, integer), public.collect_guild_medals() from public, anon;
grant execute on function public.my_guild(), public.guild_username(), public.guild_role(),
  public.create_guild(text, text, integer, integer), public.join_guild(uuid, integer), public.leave_guild(),
  public.set_guild_role(uuid, text), public.kick_guild_member(uuid), public.update_guild(text, integer),
  public.touch_guild_member(integer), public.post_guild_message(text), public.request_guild_medals(text, integer),
  public.donate_guild_medals(bigint, integer), public.collect_guild_medals() to authenticated;
