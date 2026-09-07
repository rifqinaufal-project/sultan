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
  order by commission_total desc, t.name asc;
$$;

grant execute on function public.top_commission_trader(date, date) to anon, authenticated;
