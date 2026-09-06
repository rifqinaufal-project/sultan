create extension if not exists pgcrypto;

create table if not exists public.expense_names (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table public.expense_names enable row level security;

drop policy if exists "Prototype expense names access" on public.expense_names;
create policy "Prototype expense names access"
on public.expense_names
for all
to anon, authenticated
using (true)
with check (true);
