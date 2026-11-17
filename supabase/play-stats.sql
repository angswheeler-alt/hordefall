-- Hordefall play stats: one small anonymous row per player per day, so the admin can
-- see how far players get, how long they play and whether they come back. Paste this
-- into the Supabase SQL editor and run it once, after save-backups.sql. Running it
-- again is safe: it adds what is missing and replaces the functions.
--
-- No names, no accounts, no personal data: each phone makes up a random id the first
-- time the game opens. Anyone can send their own day through report_play; only admins
-- (public.save_admins) can read the totals, on admin.html under "Play stats".

create table if not exists public.play_days (
  player text not null,
  day date not null,
  best_stage integer not null default 0,
  stage integer not null default 0,
  rekindles integer not null default 0,
  minutes integer not null default 0,
  days_played integer not null default 0,
  signed_in boolean not null default false,
  tabs text[] not null default '{}',
  first_day date not null,
  updated_at timestamptz not null default now(),
  primary key (player, day)
);
create index if not exists play_days_day on public.play_days (day desc);
alter table public.play_days enable row level security;

create or replace function public.report_play(p_player text, p_day date, p_best_stage integer, p_stage integer,
  p_rekindles integer, p_minutes integer, p_days_played integer, p_signed_in boolean, p_tabs text[])
returns void language plpgsql security definer set search_path = public as $$
declare first date;
begin
  if p_player is null or p_player !~ '^[a-z0-9]{16,40}$' or p_day is null
     or p_day < current_date - 2 or p_day > current_date + 2 then
    return;
  end if;
  -- A flood of brand-new ids (or someone spamming) can't fill the table: 5,000 new rows a day at most.
  if not exists (select 1 from play_days where player = p_player and day = p_day)
     and (select count(*) from play_days where day = p_day) >= 5000 then
    return;
  end if;
  select min(d.first_day) into first from play_days d where d.player = p_player;
  insert into play_days (player, day, best_stage, stage, rekindles, minutes, days_played, signed_in, tabs, first_day)
    values (p_player, p_day, greatest(0, least(coalesce(p_best_stage, 0), 10000000)), greatest(0, least(coalesce(p_stage, 0), 10000000)),
            greatest(0, least(coalesce(p_rekindles, 0), 1000000)), greatest(0, least(coalesce(p_minutes, 0), 1440)),
            greatest(0, least(coalesce(p_days_played, 0), 100000)), coalesce(p_signed_in, false),
            coalesce((select array_agg(distinct left(t, 20)) from unnest(p_tabs[1:20]) t where t ~ '^[a-z]{1,20}$'), '{}'),
            coalesce(first, p_day))
    on conflict (player, day) do update set
      best_stage = greatest(play_days.best_stage, excluded.best_stage),
      stage = excluded.stage,
      rekindles = greatest(play_days.rekindles, excluded.rekindles),
      minutes = greatest(play_days.minutes, excluded.minutes),
      days_played = greatest(play_days.days_played, excluded.days_played),
      signed_in = play_days.signed_in or excluded.signed_in,
      tabs = (select array_agg(distinct t) from unnest(play_days.tabs || excluded.tabs) t),
      updated_at = now();
end $$;

-- Admins: totals for each of the last p_days days, newest first. "Came back next day" counts the
-- players who started that day and also played the day after; "came back in a week" the same for day 7.
create or replace function public.admin_play_stats(p_days integer default 30)
returns table (day date, players bigint, new_players bigint, avg_minutes numeric, median_best integer,
  top_best integer, signed_in bigint, back_next_day bigint, back_day_7 bigint, tabs text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from save_admins where user_id = auth.uid()) then raise exception 'Admins only.'; end if;
  return query
    select d.day,
      count(*),
      count(*) filter (where d.first_day = d.day),
      round(avg(d.minutes), 1),
      (percentile_disc(0.5) within group (order by d.best_stage))::integer,
      max(d.best_stage),
      count(*) filter (where d.signed_in),
      (select count(*) from play_days n where n.first_day = d.day and n.day = d.day + 1),
      (select count(*) from play_days n where n.first_day = d.day and n.day = d.day + 7),
      (select string_agg(t || ' ' || c, ', ' order by c desc)
         from (select t, count(*) c from play_days x, unnest(x.tabs) t where x.day = d.day group by t) tc)
    from play_days d
    where d.day > current_date - greatest(1, least(coalesce(p_days, 30), 365))
    group by d.day
    order by d.day desc;
end $$;

-- Admins: how far players are, one row per player (their latest day), furthest first.
create or replace function public.admin_play_players(p_limit integer default 200)
returns table (player text, last_day date, first_day date, days_played integer, best_stage integer, rekindles integer, signed_in boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from save_admins where user_id = auth.uid()) then raise exception 'Admins only.'; end if;
  return query
    select l.player, l.day, l.first_day, l.days_played, l.best_stage, l.rekindles, l.signed_in
      from (select distinct on (d.player) d.* from play_days d order by d.player, d.day desc) l
      order by l.best_stage desc
      limit greatest(1, least(coalesce(p_limit, 200), 1000));
end $$;

revoke all on function public.report_play(text, date, integer, integer, integer, integer, integer, boolean, text[]) from public;
grant execute on function public.report_play(text, date, integer, integer, integer, integer, integer, boolean, text[]) to anon, authenticated;
revoke all on function public.admin_play_stats(integer), public.admin_play_players(integer) from public, anon;
grant execute on function public.admin_play_stats(integer), public.admin_play_players(integer) to authenticated;
