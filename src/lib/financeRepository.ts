import { supabase } from './supabase'

export type RemoteTrader = { id: string; name: string }
export type RemoteExpenseName = { id: string; name: string }
export type RemoteTransaction = {
  id: string | number
  type: 'Komisi' | 'Pengeluaran'
  name: string
  category: string
  date: string
  time: string
  amount: number
  note: string
}

export type DailyReportRow = {
  report_date: string
  commission_total: number
  expense_total: number
  commission_items: Array<{ id: string; name: string; amount: number; notes: string | null; created_at: string }>
  expense_items: Array<{ id: string; name: string; amount: number; notes: string | null; created_at: string }>
  total_days: number
}
export type YearlyReportRow = {
  report_month: number
  commission_total: number
  expense_total: number
}
export type TopTraderRow = { trader_name: string; commission_total: number }

export const isRemoteDataAvailable = Boolean(supabase)

export async function loadTraders() {
  if (!supabase) return { data: null, error: null }
  const result = await supabase.from('traders').select('id, name').order('name')
  return { data: result.data as RemoteTrader[] | null, error: result.error }
}

export async function loadExpenseNames() {
  if (!supabase) return { data: null, error: null }
  const result = await supabase.from('expense_names').select('id, name').order('name')
  return { data: result.data as RemoteExpenseName[] | null, error: result.error }
}

export async function createExpenseName(name: string) {
  if (!supabase) return { data: null, error: null }
  const result = await supabase.from('expense_names').insert({ name }).select('id, name').single()
  return { data: result.data as RemoteExpenseName | null, error: result.error }
}

export async function updateExpenseName(id: string, name: string) {
  if (!supabase) return { data: null, error: null }
  const result = await supabase.from('expense_names').update({ name }).eq('id', id).select('id, name').single()
  return { data: result.data as RemoteExpenseName | null, error: result.error }
}

export async function deleteExpenseName(id: string) {
  if (!supabase) return { error: null }
  const result = await supabase.from('expense_names').delete().eq('id', id)
  return { error: result.error }
}

export async function saveBatch(input: {
  date: string
  note: string
  commissions: Array<{ name: string; amount: number }>
  expenses: Array<{ name: string; amount: number }>
}) {
  if (!supabase) return { error: null }

  if (input.commissions.length) {
    const traderResult = await supabase.from('traders').upsert(
      input.commissions.map((item) => ({ name: item.name })),
      { onConflict: 'name', ignoreDuplicates: false },
    ).select('id, name')
    if (traderResult.error) return { error: traderResult.error }
    const traderIds = new Map((traderResult.data ?? []).map((trader) => [trader.name.toLocaleLowerCase('id-ID'), trader.id]))
    const commissionResult = await supabase.from('commissions').insert(input.commissions.map((item) => ({
      trader_id: traderIds.get(item.name.toLocaleLowerCase('id-ID')),
      transaction_date: input.date,
      amount: item.amount,
      notes: input.note || null,
    })))
    if (commissionResult.error) return { error: commissionResult.error }
  }

  if (input.expenses.length) {
    const expenseResult = await supabase.from('expenses').insert(input.expenses.map((item) => ({
      name: item.name,
      transaction_date: input.date,
      amount: item.amount,
      notes: input.note || null,
    })))
    if (expenseResult.error) return { error: expenseResult.error }
  }
  return { error: null }
}

export async function updateTransaction(transaction: RemoteTransaction) {
  if (!supabase) return { error: null }
  if (transaction.type === 'Komisi') {
    const traderResult = await supabase.from('traders').upsert({ name: transaction.name }, { onConflict: 'name' }).select('id').single()
    if (traderResult.error || !traderResult.data) return { error: traderResult.error ?? new Error('Trader tidak ditemukan') }
    const result = await supabase.from('commissions').update({
      trader_id: traderResult.data.id,
      transaction_date: transaction.date,
      amount: transaction.amount,
      notes: transaction.note === '-' ? null : transaction.note,
    }).eq('id', String(transaction.id)).select('id').single()
    return { error: result.error }
  }
  const result = await supabase.from('expenses').update({
    name: transaction.name,
    transaction_date: transaction.date,
    amount: transaction.amount,
    notes: transaction.note === '-' ? null : transaction.note,
  }).eq('id', String(transaction.id)).select('id').single()
  return { error: result.error }
}

export async function deleteTransaction(transaction: RemoteTransaction) {
  if (!supabase) return { error: null }
  const table = transaction.type === 'Komisi' ? 'commissions' : 'expenses'
  const result = await supabase.from(table).delete().eq('id', String(transaction.id))
  return { error: result.error }
}

export async function loadTransactions(limit = 100) {
  if (!supabase) return { data: null, error: null }
  const [commissionResult, expenseResult] = await Promise.all([
    supabase.from('commissions').select('id, transaction_date, amount, notes, created_at, traders(name)').order('transaction_date', { ascending: false }).order('created_at', { ascending: false }).limit(limit),
    supabase.from('expenses').select('id, name, transaction_date, amount, notes, created_at').order('transaction_date', { ascending: false }).order('created_at', { ascending: false }).limit(limit),
  ])
  if (commissionResult.error) return { data: null, error: commissionResult.error }
  if (expenseResult.error) return { data: null, error: expenseResult.error }
  const commissions: RemoteTransaction[] = (commissionResult.data ?? []).map((item) => ({
    id: item.id,
    type: 'Komisi',
    name: (item.traders as unknown as { name: string } | null)?.name ?? 'Tanpa nama',
    category: 'Pemasukan ikan',
    date: item.transaction_date,
    time: new Date(item.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    amount: Number(item.amount),
    note: item.notes ?? '-',
  }))
  const expenses: RemoteTransaction[] = (expenseResult.data ?? []).map((item) => ({
    id: item.id,
    type: 'Pengeluaran',
    name: item.name,
    category: 'Pengeluaran',
    date: item.transaction_date,
    time: new Date(item.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    amount: Number(item.amount),
    note: item.notes ?? '-',
  }))
  return { data: [...commissions, ...expenses].sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`)), error: null }
}

export async function loadDailyReports(page: number, daysPerPage = 5) {
  if (!supabase) return { data: null, error: null }
  const result = await supabase.rpc('daily_financial_report', { page_number: page, days_per_page: daysPerPage })
  return { data: result.data as DailyReportRow[] | null, error: result.error }
}

export async function loadYearlyReports(year: number) {
  if (!supabase) return { data: null, error: null }
  const result = await supabase.rpc('yearly_financial_report', { report_year: year })
  return { data: result.data as YearlyReportRow[] | null, error: result.error }
}

export async function loadTopTrader(startDate: string, endDate: string) {
  if (!supabase) return { data: null, error: null }
  const result = await supabase.rpc('top_commission_trader', { start_date: startDate, end_date: endDate })
  return { data: result.data as TopTraderRow[] | null, error: result.error }
}
