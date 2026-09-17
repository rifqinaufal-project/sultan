import { ArrowDown, ArrowUp, Plus } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { compactRupiah, displayDate, rupiah } from '../../lib/formatters'
import type { DashboardRange, Transaction, TransactionType } from '../../types/finance'
import { Button } from '../ui/Button'
import { inputClassName } from '../ui/FormField'
import { SegmentedControl } from '../ui/SegmentedControl'

type ChartBucket = {
  label: string
  commission: number
  expense: number
  commissionPercent: number
  expensePercent: number
}

type RankedItem = { name: string; amount: number }

type DashboardOverviewProps = {
  range: DashboardRange
  customStart: string
  customEnd: string
  today: string
  rangeStart: string
  rangeEnd: string
  commissionTotal: number
  expenseTotal: number
  transactions: Transaction[]
  topTraders: RankedItem[]
  topExpenses: RankedItem[]
  visibleTopTraders: RankedItem[]
  hasMoreTopTraders: boolean
  showAllTopTraders: boolean
  chart: { max: number; values: ChartBucket[] }
  onRangeChange: (range: DashboardRange) => void
  onCustomStartChange: (date: string) => void
  onCustomEndChange: (date: string) => void
  onToggleTopTraders: () => void
  onAddTransaction: (type: TransactionType) => void
  onViewReports: () => void
}

export function DashboardOverview(props: DashboardOverviewProps) {
  const net = props.commissionTotal - props.expenseTotal
  const margin = props.commissionTotal ? Math.round((net / props.commissionTotal) * 100) : 0

  return (
    <>
      <section className="mt-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end" aria-label="Rentang data dashboard">
        <SegmentedControl value={props.range} options={['1 hari', '7 hari', '30 hari', 'Custom']} onChange={props.onRangeChange} label="Rentang dashboard" />
        {props.range === 'Custom' && (
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <DateField label="Dari" value={props.customStart} max={props.customEnd} onChange={props.onCustomStartChange} />
            <span className="pb-3 text-xs text-zinc-500">sampai</span>
            <DateField label="Hingga" value={props.customEnd} min={props.customStart} max={props.today} onChange={props.onCustomEndChange} />
          </div>
        )}
      </section>

      <section className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4" aria-label="Ringkasan keuangan">
        <MetricCard label="Keuntungan bersih" value={compactRupiah(net)} meta={`${margin}%`} detail="margin" progress={Math.max(0, Math.min(100, margin))} inverted />
        <MetricCard label="Total pemasukan" value={compactRupiah(props.commissionTotal)} meta={displayDate(props.rangeStart)} detail={displayDate(props.rangeEnd)} progress={props.commissionTotal ? 100 : 0} />
        <MetricCard label="Total pengeluaran" value={compactRupiah(props.expenseTotal)} meta={String(props.transactions.filter((item) => item.type === 'Pengeluaran').length)} detail="transaksi" progress={props.expenseTotal ? 100 : 0} />
        <MetricCard label="Jumlah transaksi" value={String(props.transactions.length)} meta="Periode ini" detail={props.range} progress={Math.min(props.transactions.length * 10, 100)} />
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <RankingCard title="Supplier dengan komisi terbanyak" description="Semua supplier pada periode yang dipilih" items={props.visibleTopTraders} totalItems={props.topTraders.length} emptyTitle="Belum ada data komisi" emptyDescription="Catat pemasukan untuk melihat supplier teratas." emptyIcon={<ArrowDown size={20} weight="bold" />} onAdd={() => props.onAddTransaction('Komisi')} addLabel="Catat pemasukan" canToggle={props.hasMoreTopTraders} expanded={props.showAllTopTraders} onToggle={props.onToggleTopTraders} />
        <RankingCard title="Pengeluaran terbesar" description="Berdasarkan kategori pada periode ini" items={props.topExpenses} emptyTitle="Belum ada data pengeluaran" emptyDescription="Catat pengeluaran untuk melihat kategori terbesar." emptyIcon={<ArrowUp size={20} weight="bold" />} onAdd={() => props.onAddTransaction('Pengeluaran')} addLabel="Catat pengeluaran" tone="negative" />
      </div>

      <section className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <FinanceChart chart={props.chart} rangeStart={props.rangeStart} rangeEnd={props.rangeEnd} />
        <RecentTransactions transactions={props.transactions} onViewAll={props.onViewReports} />
      </section>
    </>
  )
}

function DateField({ label, value, min, max, onChange }: { label: string; value: string; min?: string; max?: string; onChange: (value: string) => void }) {
  return <label className="text-xs font-semibold text-zinc-600">{label}<input className={`${inputClassName} mt-1 min-w-0 px-2`} type="date" value={value} min={min} max={max} onChange={(event) => event.target.value && onChange(event.target.value)} /></label>
}

function MetricCard({ label, value, meta, detail, progress, inverted = false }: { label: string; value: string; meta: string; detail: string; progress: number; inverted?: boolean }) {
  return (
    <article className={cn('flex min-h-44 flex-col rounded-xl p-4 sm:p-5', inverted ? 'bg-zinc-950 text-white' : 'bg-white text-zinc-950')}>
      <span className={cn('text-xs font-semibold', inverted ? 'text-zinc-300' : 'text-zinc-500')}>{label}</span>
      <strong className="mt-4 font-display text-xl font-extrabold tracking-tight tabular-nums sm:text-2xl">{value}</strong>
      <div className={cn('mt-auto flex justify-between gap-2 text-[11px]', inverted ? 'text-zinc-300' : 'text-zinc-500')}><small>{meta}</small><small>{detail}</small></div>
      <div className={cn('mt-2 h-1 overflow-hidden rounded-full', inverted ? 'bg-zinc-700' : 'bg-zinc-200')}><i className={cn('block h-full rounded-full', inverted ? 'bg-white' : 'bg-zinc-950')} style={{ width: `${progress}%` }} /></div>
    </article>
  )
}

function RankingCard({ title, description, items, totalItems, emptyTitle, emptyDescription, emptyIcon, onAdd, addLabel, canToggle = false, expanded = false, onToggle, tone = 'neutral' }: { title: string; description: string; items: RankedItem[]; totalItems?: number; emptyTitle: string; emptyDescription: string; emptyIcon: ReactNode; onAdd: () => void; addLabel: string; canToggle?: boolean; expanded?: boolean; onToggle?: () => void; tone?: 'neutral' | 'negative' }) {
  return (
    <section className={cn('rounded-xl p-5', tone === 'negative' ? 'bg-red-50' : 'bg-white')}>
      <header><h2 className="text-sm font-bold">{title}</h2><p className="mt-1 text-xs text-zinc-500">{description}</p></header>
      {items.length ? <><div className="mt-4 divide-y divide-zinc-200">{items.map((item, index) => <div className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 py-3" key={item.name}><span className={cn('grid h-7 place-items-center rounded-md border text-xs font-extrabold', index === 0 ? 'border-zinc-950 bg-zinc-950 text-white' : 'border-zinc-300 bg-white')}>#{index + 1}</span><strong className="min-w-0 break-words text-sm">{item.name}</strong><b className={cn('text-xs tabular-nums', tone === 'negative' && 'text-red-700')}>{rupiah(item.amount)}</b></div>)}</div>{canToggle && <button className="mt-1 min-h-11 w-full border-t border-zinc-200 text-xs font-bold transition hover:text-zinc-500" type="button" onClick={onToggle}>{expanded ? 'Tampilkan lebih sedikit' : `Lihat semua (${totalItems})`}</button>}</> : <div className="mt-4 grid grid-cols-[auto_1fr] items-center gap-3 rounded-lg border border-dashed border-zinc-300 bg-white/70 p-4"><span className="grid size-10 place-items-center rounded-lg bg-zinc-100">{emptyIcon}</span><div><strong className="block text-sm">{emptyTitle}</strong><span className="mt-1 block text-xs leading-relaxed text-zinc-500">{emptyDescription}</span></div><Button className="col-span-2 w-full" variant="secondary" size="sm" type="button" onClick={onAdd}><Plus size={15} weight="bold" />{addLabel}</Button></div>}
    </section>
  )
}

function FinanceChart({ chart, rangeStart, rangeEnd }: { chart: DashboardOverviewProps['chart']; rangeStart: string; rangeEnd: string }) {
  return (
    <article className="rounded-xl bg-white p-5 sm:p-6">
      <header><h2 className="font-display text-xl font-extrabold tracking-tight">Arus keuangan</h2><p className="mt-1 text-xs text-zinc-500">{displayDate(rangeStart)} sampai {displayDate(rangeEnd)}</p></header>
      <div className="mt-7 grid h-64 grid-cols-[4.5rem_1fr] gap-3">
        <div className="flex flex-col justify-between text-[10px] tabular-nums text-zinc-500">{[chart.max, chart.max * 0.75, chart.max * 0.5, chart.max * 0.25, 0].map((tick) => <span key={tick}>{compactRupiah(tick)}</span>)}</div>
        <div className="flex items-end justify-around gap-2 border-b border-l border-zinc-200 px-2 pt-2">{chart.values.map((bucket) => <div className="flex h-full flex-1 items-end justify-center gap-1 pb-7" key={bucket.label}><div className="w-3 rounded-t bg-zinc-950 sm:w-4" style={{ height: `${bucket.commissionPercent}%` }} /><div className="w-3 rounded-t bg-zinc-300 sm:w-4" style={{ height: `${bucket.expensePercent}%` }} /><small className="absolute mt-6 translate-y-6 text-[10px] text-zinc-500">{bucket.label}</small></div>)}</div>
      </div>
      <div className="mt-5 flex justify-end gap-4 text-xs text-zinc-600"><span className="flex items-center gap-2"><i className="size-2.5 rounded-sm bg-zinc-950" />Pemasukan</span><span className="flex items-center gap-2"><i className="size-2.5 rounded-sm bg-zinc-300" />Pengeluaran</span></div>
    </article>
  )
}

function RecentTransactions({ transactions, onViewAll }: { transactions: Transaction[]; onViewAll: () => void }) {
  return (
    <article className="rounded-xl bg-white p-5 sm:p-6">
      <header className="flex items-start justify-between gap-4"><div><h2 className="font-display text-xl font-extrabold tracking-tight">Transaksi terbaru</h2><p className="mt-1 text-xs text-zinc-500">Catatan yang baru dibuat</p></div><button className="text-xs font-bold text-zinc-600 hover:text-zinc-950" onClick={onViewAll}>Lihat semua</button></header>
      <div className="mt-5 divide-y divide-zinc-200">{transactions.length ? transactions.slice(0, 5).map((item) => <div className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 py-3" key={item.id}><span className="grid size-9 place-items-center rounded-lg bg-zinc-100">{item.type === 'Komisi' ? <ArrowDown size={18} weight="bold" /> : <ArrowUp size={18} weight="bold" />}</span><div className="min-w-0"><strong className="block truncate text-sm">{item.name}</strong><small className="mt-1 block truncate text-[11px] text-zinc-500">{displayDate(item.date)} · {item.time}</small></div><b className={cn('text-xs tabular-nums', item.type === 'Komisi' ? 'text-emerald-700' : 'text-red-700')}>{item.type === 'Komisi' ? '+' : '-'}{rupiah(item.amount)}</b></div>) : <div className="py-12 text-center"><strong className="block text-sm">Belum ada transaksi</strong><span className="mt-1 block text-xs text-zinc-500">Tidak ada catatan pada rentang ini.</span></div>}</div>
    </article>
  )
}
