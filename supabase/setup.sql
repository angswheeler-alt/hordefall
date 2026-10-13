-- Hordefall cloud saves. Paste this into the Supabase SQL editor and run it once.
-- Each signed-in player has one row; row-level security lets a player read and
-- write only their own save.

create table if not exists public.saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  best_stage integer not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.saves enable row level security;

drop policy if exists "Players read their own save" on public.saves;
create policy "Players read their own save" on public.saves
  for select using (auth.uid() = user_id);

drop policy if exists "Players create their own save" on public.saves;
create policy "Players create their own save" on public.saves
  for insert with check (auth.uid() = user_id);

drop policy if exists "Players update their own save" on public.saves;
create policy "Players update their own save" on public.saves
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
