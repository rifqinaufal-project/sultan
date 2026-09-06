create extension if not exists pgcrypto;

create table if not exists public.traders (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.commissions (
  id uuid primary key default gen_random_uuid(),
  trader_id uuid not null references public.traders(id),
  transaction_date date not null default current_date,
  amount numeric(15, 2) not null check (amount > 0),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  transaction_date date not null default current_date,
  amount numeric(15, 2) not null check (amount > 0),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.expense_names (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists commissions_date_idx on public.commissions (transaction_date desc, created_at desc);
create index if not exists expenses_date_idx on public.expenses (transaction_date desc, created_at desc);

alter table public.traders enable row level security;
alter table public.commissions enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_names enable row level security;

drop policy if exists "Prototype traders access" on public.traders;
drop policy if exists "Prototype commissions access" on public.commissions;
drop policy if exists "Prototype expenses access" on public.expenses;
drop policy if exists "Prototype expense names access" on public.expense_names;

create policy "Prototype traders access" on public.traders for all to anon, authenticated using (true) with check (true);
create policy "Prototype commissions access" on public.commissions for all to anon, authenticated using (true) with check (true);
create policy "Prototype expenses access" on public.expenses for all to anon, authenticated using (true) with check (true);
create policy "Prototype expense names access" on public.expense_names for all to anon, authenticated using (true) with check (true);

create or replace function public.daily_financial_report(page_number integer default 1, days_per_page integer default 5)
returns table (
  report_date date,
  commission_total numeric,
  expense_total numeric,
  commission_items jsonb,
  expense_items jsonb,
  total_days bigint
)
language sql
stable
as $$
  with days as (
    select transaction_date from public.commissions
    union
    select transaction_date from public.expenses
  ), paged_days as (
    select transaction_date
    from days
    order by transaction_date desc
    offset greatest(page_number - 1, 0) * least(greatest(days_per_page, 1), 50)
    limit least(greatest(days_per_page, 1), 50)
  ), all_days as (
    select count(*)::bigint as total_days from days
  )
  select
    pd.transaction_date,
    coalesce((select sum(c.amount) from public.commissions c where c.transaction_date = pd.transaction_date), 0),
    coalesce((select sum(e.amount) from public.expenses e where e.transaction_date = pd.transaction_date), 0),
    coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', t.name, 'amount', c.amount, 'notes', c.notes, 'created_at', c.created_at) order by c.created_at desc) from public.commissions c join public.traders t on t.id = c.trader_id where c.transaction_date = pd.transaction_date), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'name', e.name, 'amount', e.amount, 'notes', e.notes, 'created_at', e.created_at) order by e.created_at desc) from public.expenses e where e.transaction_date = pd.transaction_date), '[]'::jsonb),
    ad.total_days
  from paged_days pd cross join all_days ad
  order by pd.transaction_date desc;
$$;

grant execute on function public.daily_financial_report(integer, integer) to anon, authenticated;

create or replace function public.yearly_financial_report(report_year integer)
returns table (
  report_month integer,
  commission_total numeric,
  expense_total numeric
)
language sql
stable
as $$
  select months.report_month,
    coalesce((select sum(c.amount) from public.commissions c where extract(year from c.transaction_date) = report_year and extract(month from c.transaction_date) = months.report_month), 0),
    coalesce((select sum(e.amount) from public.expenses e where extract(year from e.transaction_date) = report_year and extract(month from e.transaction_date) = months.report_month), 0)
  from generate_series(1, 12) as months(report_month)
  order by months.report_month;
$$;

grant execute on function public.yearly_financial_report(integer) to anon, authenticated;

create or replace function public.top_commission_trader(start_date date, end_date date)
returns table (
  trader_name text,
  commission_total numeric
)
language sql
stable
as $$
  select t.name, sum(c.amount) as commission_total
  from public.commissions c
  join public.traders t on t.id = c.trader_id
  where c.transaction_date between start_date and end_date
  group by t.id, t.name
  order by commission_total desc, t.name asc
  limit 3;
$$;

grant execute on function public.top_commission_trader(date, date) to anon, authenticated;
