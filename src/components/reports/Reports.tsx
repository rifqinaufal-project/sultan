import { ArrowDown, ArrowUp, CaretLeft, CaretRight, FilePdf, FileXls, PencilSimple, Trash } from '@phosphor-icons/react'
import { useState } from 'react'
import { exportMonthlyExcel, exportMonthlyPdf, exportReport, exportStatementExcel, exportStatementPdf, type ExportFormat } from '../../lib/exportReport'
import type { DailyReportRow } from '../../lib/financeRepository'
import { displayDate, MONTHS, rupiah, TODAY } from '../../lib/formatters'
import { cn } from '../../lib/cn'
import type { AnnualReportRow, Transaction } from '../../types/finance'
import { Button } from '../ui/Button'
import { inputClassName } from '../ui/FormField'

const REPORT_DAYS_PER_PAGE = 7

function ExportButtons({ onExport, compact = false, disabled = false }: { onExport: (format: ExportFormat) => Promise<void> | void; compact?: boolean; disabled?: boolean }) {
  const [busy, setBusy] = useState<ExportFormat | null>(null)
  const [error, setError] = useState('')

  const handleExport = async (format: ExportFormat) => {
    setBusy(format)
    setError('')
    try {
      await onExport(format)
    } catch {
      setError('Export gagal. Coba lagi.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button variant="secondary" size="sm" disabled={disabled || busy !== null} onClick={() => void handleExport('pdf')} title="Export PDF" aria-label="Export PDF"><FilePdf size={17} />{!compact && <span>{busy === 'pdf' ? 'Memproses' : 'PDF'}</span>}</Button>
      <Button variant="secondary" size="sm" disabled={disabled || busy !== null} onClick={() => void handleExport('xlsx')} title="Export Excel" aria-label="Export Excel"><FileXls size={17} />{!compact && <span>{busy === 'xlsx' ? 'Memproses' : 'Excel'}</span>}</Button>
      {error && <span className="w-full text-xs text-red-700" role="alert">{error}</span>}
    </div>
  )
}

function DailyItem({ item, sign, onEdit, onDelete }: { item: Transaction; sign: '+' | '-'; onEdit: (item: Transaction) => void; onDelete: (item: Transaction) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-zinc-200 py-3 last:border-0">
      <div className="min-w-0">
        <strong className="block truncate text-sm">{item.name}</strong>
        <small className="mt-1 block truncate text-xs text-zinc-500">{item.time} · {item.category} · {item.note}</small>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center">
        <b className={cn('text-xs tabular-nums', sign === '+' ? 'text-emerald-700' : 'text-red-700')}>{sign}{rupiah(item.amount)}</b>
        <span className="flex gap-1">
          <Button variant="icon" size="sm" className="size-9 px-0" type="button" onClick={() => onEdit(item)} aria-label={`Edit ${item.name}`}><PencilSimple size={16} /></Button>
          <Button variant="danger" size="sm" className="size-9 px-0" type="button" onClick={() => onDelete(item)} aria-label={`Hapus ${item.name}`}><Trash size={16} /></Button>
        </span>
      </div>
    </div>
  )
}

type DailyReportsProps = {
  transactions: Transaction[]
  remoteRows: DailyReportRow[] | null
  remoteTotal: number
  remotePage: number
  onRemotePageChange: (page: number) => void
  remoteLoading: boolean
  onEdit: (transaction: Transaction) => void
  onDelete: (transaction: Transaction) => void
  onDeleteDay: (date: string, items: Transaction[]) => Promise<void>
}

export function DailyReports({ transactions, remoteRows, remoteTotal, remotePage, onRemotePageChange, remoteLoading, onEdit, onDelete, onDeleteDay }: DailyReportsProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [deletingDate, setDeletingDate] = useState<string | null>(null)
  const [editingDate, setEditingDate] = useState<{ date: string; items: Transaction[] } | null>(null)
  const [newDateInput, setNewDateInput] = useState('')
  const availableMonths = Array.from(new Set(transactions.map((item) => item.date.slice(0, 7)))).sort().reverse()
  const [exportMonth, setExportMonth] = useState(availableMonths[0] ?? TODAY.slice(0, 7))
  const grouped = remoteRows !== null
    ? remoteRows.map((row): [string, Transaction[]] => [row.report_date, [
      ...row.commission_items.map((item): Transaction => ({ id: item.id, type: 'Komisi', name: item.name, category: 'Pemasukan ikan', date: row.report_date, time: new Date(item.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }), amount: Number(item.amount), note: item.notes ?? '-' })),
      ...row.expense_items.map((item): Transaction => ({ id: item.id, type: 'Pengeluaran', name: item.name, category: 'Pengeluaran', date: row.report_date, time: new Date(item.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }), amount: Number(item.amount), note: item.notes ?? '-' })),
    ]])
    : Object.entries(transactions.reduce<Record<string, Transaction[]>>((days, item) => {
      days[item.date] = [...(days[item.date] ?? []), item]
      return days
    }, {})).sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
  const totalPages = remoteRows !== null ? Math.max(1, Math.ceil(remoteTotal / REPORT_DAYS_PER_PAGE)) : Math.max(1, Math.ceil(grouped.length / REPORT_DAYS_PER_PAGE))
  const page = remoteRows !== null ? remotePage : Math.min(currentPage, totalPages)
  const visibleDays = remoteRows !== null ? grouped : grouped.slice((page - 1) * REPORT_DAYS_PER_PAGE, page * REPORT_DAYS_PER_PAGE)

  const goToPage = (nextPage: number) => remoteRows !== null ? onRemotePageChange(nextPage) : setCurrentPage(nextPage)
  const deleteDay = async (date: string, items: Transaction[]) => {
    setDeletingDate(date)
    try { await onDeleteDay(date, items) } finally { setDeletingDate(null) }
  }
  const editDay = (date: string, items: Transaction[]) => {
    setEditingDate({ date, items })
    setNewDateInput(date)
  }
  const updateDailyDate = async (items: Transaction[], newDate: string) => {
    if (!newDate || !editingDate) return
    // Check if new date is valid
    const now = new Date()
    const [year, month, day] = newDate.split('-').map(Number)
    const dateObj = new Date(year, month - 1, day)
    if (dateObj > now || dateObj.getFullYear() < 2000) {
      alert('Tanggal tidak boleh di masa depan atau terlalu lama di masa lalu')
      return
    }
    
    try {
      // Update each transaction individually
      for (const item of items) {
        await onEdit({ ...item, date: newDate })
      }
    } catch (error) {
      console.error('Failed to update date:', error)
      alert('Gagal mengubah tanggal')
      return
    } finally {
      setEditingDate(null)
    }
  }
  const closeEditModal = () => {
    setEditingDate(null)
    setNewDateInput('')
  }
  const exportDaily = async (format: ExportFormat, date: string, items: Transaction[]) => {
    const rows = items.map((item) => ({ date, type: item.type === 'Komisi' ? 'Pemasukan' as const : 'Pengeluaran' as const, time: item.time, name: item.name, category: item.category, note: item.note, amount: item.amount }))
    if (format === 'pdf') await exportStatementPdf('Laporan harian', `laporan-harian-${date}`, rows)
    else await exportStatementExcel('Laporan harian', `laporan-harian-${date}`, rows)
  }
  const exportMonthly = async (format: ExportFormat) => {
    const items = transactions.filter((item) => item.date.startsWith(exportMonth))
    const [year, month] = exportMonth.split('-')
    const title = `Laporan ${MONTHS[Number(month) - 1]} ${year}`
    const rows = items.map((item) => ({ date: item.date, type: item.type === 'Komisi' ? 'Pemasukan' as const : 'Pengeluaran' as const, time: item.time, name: item.name, category: item.category, note: item.note, amount: item.amount }))
    if (format === 'pdf') await exportMonthlyPdf(title, `laporan-bulanan-${exportMonth}`, rows)
    else await exportMonthlyExcel(title, `laporan-bulanan-${exportMonth}`, rows)
  }

  return (
    <>
    <section className="grid gap-4">
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:flex-row sm:items-center">
        <div><strong className="text-sm">Export per bulan</strong><span className="mt-1 block text-xs text-zinc-500">Pilih bulan dan format laporan.</span></div>
        <div className="flex items-center gap-2"><label className="sr-only" htmlFor="report-month">Bulan laporan</label><input id="report-month" className={`${inputClassName} mt-0 w-auto`} type="month" value={exportMonth} max={TODAY.slice(0, 7)} onChange={(event) => event.target.value && setExportMonth(event.target.value)} /><ExportButtons onExport={exportMonthly} /></div>
      </div>
      {remoteLoading ? <ReportState>Memuat laporan...</ReportState> : visibleDays.length ? visibleDays.map(([date, items]) => {
        const commissions = items.filter((item) => item.type === 'Komisi')
        const expenses = items.filter((item) => item.type === 'Pengeluaran')
        const commissionTotal = commissions.reduce((total, item) => total + item.amount, 0)
        const expenseTotal = expenses.reduce((total, item) => total + item.amount, 0)
        const net = commissionTotal - expenseTotal
        return (
          <article className="overflow-hidden rounded-xl border border-zinc-200 bg-white" key={date}>
            <header className="flex flex-col justify-between gap-4 border-b border-zinc-200 p-5 sm:flex-row sm:items-center">
              <div><h2 className="font-display text-xl font-extrabold tracking-tight">{displayDate(date)}</h2><p className="mt-1 text-xs text-zinc-500">{items.length} transaksi tercatat</p></div>
              <div className="flex flex-wrap items-center gap-2"><strong className={cn('text-base tabular-nums', net >= 0 ? 'text-emerald-700' : 'text-red-700')}>{rupiah(net)}</strong><ExportButtons compact onExport={(format) => exportDaily(format, date, items)} /><Button variant="secondary" size="sm" onClick={() => void editDay(date, items)} aria-label={`Edit tanggal ${displayDate(date)}`}><PencilSimple size={17} /><span className="hidden sm:inline">Edit tanggal</span></Button><Button variant="danger" size="sm" disabled={deletingDate !== null} onClick={() => void deleteDay(date, items)} aria-label={`Hapus seluruh transaksi ${displayDate(date)}`}><Trash size={17} /><span className="hidden sm:inline">{deletingDate === date ? 'Menghapus...' : 'Hapus hari'}</span></Button></div>
            </header>
            <div className="grid md:grid-cols-2">
              <DailyColumn title="Pemasukan" items={commissions} icon={<ArrowDown size={18} weight="bold" />} sign="+" onEdit={onEdit} onDelete={onDelete} />
              <DailyColumn title="Pengeluaran" items={expenses} icon={<ArrowUp size={18} weight="bold" />} sign="-" onEdit={onEdit} onDelete={onDelete} className="border-t md:border-l md:border-t-0" />
            </div>
            <footer className="grid border-t border-zinc-200 sm:grid-cols-3">
              <Total label="Total pemasukan" value={commissionTotal} className="text-emerald-700" />
              <Total label="Total pengeluaran" value={expenseTotal} className="border-t text-red-700 sm:border-l sm:border-t-0" />
              <Total label={net >= 0 ? 'Laba bersih' : 'Rugi bersih'} value={net} className={cn('border-t text-white sm:border-l sm:border-t-0', net >= 0 ? 'bg-emerald-800' : 'bg-red-800')} />
            </footer>
          </article>
        )
      }) : <ReportState><strong>Belum ada laporan harian</strong><span className="mt-1 block">Transaksi yang dicatat akan dikelompokkan berdasarkan tanggal.</span></ReportState>}
      <footer className="flex flex-col justify-between gap-3 text-xs text-zinc-500 sm:flex-row sm:items-center"><p>Maksimal {REPORT_DAYS_PER_PAGE} hari per halaman</p><div className="flex items-center gap-3"><Button variant="icon" size="sm" className="size-10 px-0" onClick={() => goToPage(Math.max(1, page - 1))} disabled={page === 1 || remoteLoading} aria-label="Halaman sebelumnya"><CaretLeft size={18} /></Button><span>Halaman <strong className="text-zinc-950">{page}</strong> dari {totalPages}</span><Button variant="icon" size="sm" className="size-10 px-0" onClick={() => goToPage(Math.min(totalPages, page + 1))} disabled={page === totalPages || remoteLoading} aria-label="Halaman berikutnya"><CaretRight size={18} /></Button></div></footer>
    </section>
    <EditDateModal 
      isOpen={editingDate !== null}
      onClose={closeEditModal}
      date={editingDate?.date ?? ''}
      items={editingDate?.items ?? []}
      onSave={updateDailyDate}
    />
    </>
  )
}

// Modal untuk edit tanggal
function EditDateModal({ isOpen, onClose, date, items, onSave }: { isOpen: boolean; onClose: () => void; date: string; items: Transaction[]; onSave: (newDate: string) => Promise<void> }) {
  const [newDate, setNewDate] = useState(date)
  
  const handleSave = async () => {
    if (!newDate) return
    try {
      await onSave(newDate)
      onClose()
    } catch (error) {
      console.error('Failed to update:', error)
    }
  }

  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
        <h3 className="text-lg font-bold text-zinc-950">Edit Tanggal</h3>
        <p className="mt-1 text-sm text-zinc-500">
          Ubah tanggal untuk {items.length} transaksi di {displayDate(date)}
        </p>
        
        <div className="mt-4">
          <label className="mb-2 block text-sm font-medium text-zinc-700">
            Tanggal baru
          </label>
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className={`${inputClassName} w-full`}
            max={TODAY.slice(0, 10)}
          />
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button onClick={handleSave}>Simpan Perubahan</Button>
        </div>
      </div>
    </div>
  )
}

function DailyColumn({ title, items, icon, sign, onEdit, onDelete, className }: { title: string; items: Transaction[]; icon: React.ReactNode; sign: '+' | '-'; onEdit: (item: Transaction) => void; onDelete: (item: Transaction) => void; className?: string }) {
  return <section className={cn('border-zinc-200 p-5', className)}><div className="mb-3 flex items-center gap-3"><span className="grid size-9 place-items-center rounded-lg bg-zinc-100">{icon}</span><div><h3 className="text-sm font-bold">{title}</h3><p className="text-xs text-zinc-500">{items.length} transaksi</p></div></div><div className="border-t border-zinc-200">{items.length ? items.map((item) => <DailyItem item={item} sign={sign} onEdit={onEdit} onDelete={onDelete} key={item.id} />) : <p className="py-5 text-xs text-zinc-500">Tidak ada {title.toLocaleLowerCase('id-ID')}.</p>}</div></section>
}

function Total({ label, value, className }: { label: string; value: number; className?: string }) {
  return <div className={cn('border-zinc-200 p-4', className)}><span className="block text-xs opacity-75">{label}</span><strong className="mt-1 block text-sm tabular-nums">{rupiah(value)}</strong></div>
}

function ReportState({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-5 py-12 text-center text-sm text-zinc-500" role="status">{children}</div>
}

export function AnnualReport({ year, years, onYearChange, rows, commission, expense, loading }: { year: string; years: string[]; onYearChange: (year: string) => void; rows: AnnualReportRow[]; commission: number; expense: number; loading: boolean }) {
  const exportAnnual = (format: ExportFormat) => exportReport(format, `Laporan tahunan ${year}`, `laporan-tahunan-${year}`, rows.map((row) => ({ Bulan: row.month, Pemasukan: row.commission, Pengeluaran: row.expense, 'Laba Bersih': row.net })))
  return (
    <section className="rounded-xl bg-white p-5 sm:p-7">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start"><div><h2 className="font-display text-xl font-extrabold tracking-tight">Ringkasan {year}</h2><p className="mt-1 text-sm text-zinc-500">Rekap keuangan dari Januari sampai Desember.</p></div><div className="flex items-end gap-2"><label className="text-xs font-bold text-zinc-600">Tahun<select className={`${inputClassName} mt-1 min-w-24`} value={year} onChange={(event) => onYearChange(event.target.value)}>{years.map((option) => <option key={option}>{option}</option>)}</select></label><ExportButtons disabled={loading} onExport={exportAnnual} /></div></header>
      {loading ? <div className="mt-6"><ReportState>Memuat ringkasan tahunan...</ReportState></div> : <><div className="mt-6 grid overflow-hidden rounded-xl border border-zinc-200 sm:grid-cols-3"><Total label="Total pemasukan" value={commission} className="text-emerald-700" /><Total label="Total pengeluaran" value={expense} className="border-t text-red-700 sm:border-l sm:border-t-0" /><Total label="Laba tahunan" value={commission - expense} className="border-t bg-zinc-950 text-white sm:border-l sm:border-t-0" /></div><div className="mt-7 overflow-x-auto"><table className="w-full min-w-[620px] border-collapse text-sm"><caption className="sr-only">Ringkasan keuangan per bulan untuk tahun {year}</caption><thead><tr className="border-b border-zinc-300 text-left text-xs text-zinc-500"><th className="px-3 py-3">Bulan</th><th className="px-3 py-3 text-right">Pemasukan</th><th className="px-3 py-3 text-right">Pengeluaran</th><th className="px-3 py-3 text-right">Laba bersih</th></tr></thead><tbody>{rows.map((row) => <tr className="border-b border-zinc-200 last:border-0" key={row.month}><td className="px-3 py-3 font-bold">{row.month}</td><td className="px-3 py-3 text-right tabular-nums text-emerald-700">{rupiah(row.commission)}</td><td className="px-3 py-3 text-right tabular-nums text-red-700">{rupiah(row.expense)}</td><td className="px-3 py-3 text-right font-bold tabular-nums">{rupiah(row.net)}</td></tr>)}</tbody></table></div></>}
    </section>
  )
}
