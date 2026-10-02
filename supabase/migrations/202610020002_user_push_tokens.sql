create table if not exists public.push_tokens (
  token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);

create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

drop policy if exists "users read own push tokens" on public.push_tokens;
create policy "users read own push tokens" on public.push_tokens
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "users add own push tokens" on public.push_tokens;
create policy "users add own push tokens" on public.push_tokens
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "users update own push tokens" on public.push_tokens;
create policy "users update own push tokens" on public.push_tokens
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "users remove own push tokens" on public.push_tokens;
create policy "users remove own push tokens" on public.push_tokens
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.push_tokens from anon;
grant select, insert, update, delete on public.push_tokens to authenticated;
