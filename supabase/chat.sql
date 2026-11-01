-- Hordefall all chat: one chat room for every signed-in player. Paste this into
-- the Supabase SQL editor and run it once, after setup.sql and save-backups.sql.
-- Running it again is safe: it adds what is missing and replaces the functions.
--
-- Every signed-in player can read the newest messages; writing goes through
-- post_world_message, which checks the length and how fast a player posts.
-- Admins (public.save_admins, from save-backups.sql) can delete a message.

create table if not exists public.world_messages (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  username text not null,
  body text not null check (char_length(body) between 1 and 200),
  created_at timestamptz not null default now()
);
create index if not exists world_messages_user on public.world_messages (user_id, created_at desc);
alter table public.world_messages enable row level security;

drop policy if exists "Signed-in players read all chat" on public.world_messages;
create policy "Signed-in players read all chat" on public.world_messages for select to authenticated using (true);

create or replace function public.post_world_message(p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in to chat.'; end if;
  p_body := left(btrim(coalesce(p_body, '')), 200);
  if p_body = '' then return; end if;
  if exists (select 1 from world_messages where user_id = me and created_at > now() - interval '5 seconds') then
    raise exception 'Slow down a little.';
  end if;
  if (select count(*) from world_messages where user_id = me and created_at > now() - interval '1 minute') >= 6 then
    raise exception 'That''s a lot of messages. Wait a minute.';
  end if;
  insert into world_messages (user_id, username, body)
    values (me, coalesce((select coalesce(raw_user_meta_data ->> 'username', split_part(email, '@', 1)) from auth.users where id = me), 'player'), p_body);
  -- Keep the newest 500 messages.
  delete from world_messages where id < (select min(id) from (select id from world_messages order by id desc limit 500) t);
end $$;

-- Admins remove a message.
create or replace function public.delete_world_message(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from save_admins where user_id = auth.uid()) then raise exception 'Admins only.'; end if;
  delete from world_messages where id = p_id;
end $$;

revoke all on function public.post_world_message(text), public.delete_world_message(bigint) from public, anon;
grant execute on function public.post_world_message(text), public.delete_world_message(bigint) to authenticated;
