-- Catalogo Buste WR: shared "Volumi" notes, editable from the app.
-- Run once in Supabase → SQL Editor → New query → paste → Run.
-- BEFORE RUNNING: put Pomo's email in the list at the bottom (the one he signs in with).

-- One note per format, the same for everybody. Overrides data/volumi.json in the app.
create table if not exists public.volumi (
  id         text primary key,                 -- format id, e.g. fumetti~manga-tp1
  text       text not null default '',
  updated_at timestamptz not null default now(),
  updated_by text                              -- email of who saved it last
);

-- Who may edit the notes.
create table if not exists public.editors (
  email text primary key
);

alter table public.volumi  enable row level security;
alter table public.editors enable row level security;

drop policy if exists "anyone reads volumi"   on public.volumi;
drop policy if exists "editors add volumi"    on public.volumi;
drop policy if exists "editors change volumi" on public.volumi;
drop policy if exists "see own editor row"    on public.editors;

-- Everyone (even signed out) can read the notes.
create policy "anyone reads volumi" on public.volumi for select to anon, authenticated using (true);

-- Only signed-in people listed in public.editors can write.
create policy "editors add volumi" on public.volumi for insert to authenticated
  with check (exists (select 1 from public.editors e where lower(e.email) = lower(auth.jwt() ->> 'email')));
create policy "editors change volumi" on public.volumi for update to authenticated
  using      (exists (select 1 from public.editors e where lower(e.email) = lower(auth.jwt() ->> 'email')))
  with check (exists (select 1 from public.editors e where lower(e.email) = lower(auth.jwt() ->> 'email')));

-- The app checks whether you are an editor by looking for your own row (and can't see the others).
create policy "see own editor row" on public.editors for select to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));

grant select on public.volumi to anon, authenticated;
grant insert, update on public.volumi to authenticated;
grant select on public.editors to authenticated;
revoke insert, update, delete on public.editors from anon, authenticated;

-- Editors. Add or remove people here (or in Table Editor → editors).
insert into public.editors (email) values
  ('francesco.bovo1993@gmail.com'),
  ('pomo_7@hotmail.it')       
on conflict do nothing;
