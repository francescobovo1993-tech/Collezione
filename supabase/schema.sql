-- Catalogo Buste WR: one row of personal state per signed-in user.
-- Run once in Supabase → SQL Editor → New query → paste → Run.

create table if not exists public.user_state (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  state      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Row-level security: everyone can only see and change their own row.
alter table public.user_state enable row level security;

drop policy if exists "read own state"   on public.user_state;
drop policy if exists "insert own state" on public.user_state;
drop policy if exists "update own state" on public.user_state;
drop policy if exists "delete own state" on public.user_state;

create policy "read own state"   on public.user_state for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own state" on public.user_state for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own state" on public.user_state for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "delete own state" on public.user_state for delete to authenticated using ((select auth.uid()) = user_id);

-- No access at all for signed-out visitors.
revoke all on public.user_state from anon;
grant select, insert, update, delete on public.user_state to authenticated;
