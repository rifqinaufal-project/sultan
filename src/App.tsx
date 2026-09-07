import { startTransition, useEffect, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  CaretLeft,
  CaretRight,
  FilePdf,
  FileXls,
  PencilSimple,
  Plus,
  Receipt,
  SignOut,
  SquaresFour,
  Trash,
  X,
} from '@phosphor-icons/react'
import { exportMonthlyPdf, exportReport, type ExportFormat } from './lib/exportReport'
import { createExpenseName, deleteExpenseName, deleteTransaction, isRemoteDataAvailable, loadDailyReports, loadExpenseNames, loadTransactions, loadTopTrader, loadTraders, loadYearlyReports, saveBatch, updateExpenseName, updateTransaction, type DailyReportRow, type RemoteExpenseName } from './lib/financeRepository'
import './App.css'

type Page = 'Dashboard' | 'Laporan'
type TransactionType = 'Komisi' | 'Pengeluaran'
type DashboardRange = '1 hari' | '7 hari' | '30 hari' | 'Custom'
type ReportView = 'Transaksi' | 'Tahunan'
type BatchEntry = {
  id: string
  name: string
  customName: string
  amount: string
}
type Transaction = {
  id: number | string
  type: TransactionType
  name: string
  category: string
  date: string
  time: string
  amount: number
  note: string
}

const initialTransactions: Transaction[] = [
  { id: 1, type: 'Komisi', name: 'Budi Santoso', category: 'Pemasukan ikan', date: '2026-09-05', time: '08:42', amount: 2850000, note: 'Setoran ikan tongkol' },
  { id: 2, type: 'Pengeluaran', name: 'Solar kapal', category: 'Operasional', date: '2026-09-05', time: '07:15', amount: 640000, note: 'Kebutuhan melaut' },
  { id: 3, type: 'Komisi', name: 'Siti Rahma', category: 'Pemasukan ikan', date: '2026-09-04', time: '16:20', amount: 1975000, note: 'Setoran ikan cakalang' },
  { id: 4, type: 'Pengeluaran', name: 'Transportasi', category: 'Transportasi', date: '2026-09-04', time: '13:05', amount: 275000, note: 'Pengiriman ke pasar' },
]

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const REPORT_DAYS_PER_PAGE = 5
const TOP_TRADER_PREVIEW_COUNT = 5
const AUTH_STORAGE_KEY = 'sultan-admin-authenticated'
const ADMIN_USERNAME = 'admin'
const ADMIN_PASSWORD = 'admin'
const NEW_EXPENSE = '__new_expense__'
const initialExpenseNames = ['Solar kapal', 'Transportasi', 'Makanan kru', 'Gaji karyawan']
const initialTraderNames = ['Budi Santoso', 'Siti Rahma']

const loadTraderNames = () => {
  try {
    const saved = window.localStorage.getItem('sultan-trader-names')
    return saved ? JSON.parse(saved) as string[] : initialTraderNames
  } catch {
    return initialTraderNames
  }
}

const createBatchEntry = (type: TransactionType): BatchEntry => ({
  id: crypto.randomUUID(),
  name: type === 'Pengeluaran' ? initialExpenseNames[0] : '',
  customName: '',
  amount: '',
})

const rupiah = (value: number) => new Intl.NumberFormat('id-ID', {
  style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
}).format(value)

const compactRupiah = (value: number) => `Rp ${(value / 1000000).toLocaleString('id-ID', { maximumFractionDigits: 2 })} jt`

const displayDate = (value: string) => new Intl.DateTimeFormat('id-ID', {
  day: '2-digit', month: 'short', year: 'numeric',
}).format(new Date(`${value}T00:00:00`))

const localToday = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const getDateDaysBefore = (dateValue: string, days: number) => {
  const [year, month, day] = dateValue.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() - days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const TODAY = localToday()

const buildChartBuckets = (items: Transaction[], start: string, end: string) => {
  const [startYear, startMonth, startDay] = start.split('-').map(Number)
  const [endYear, endMonth, endDay] = end.split('-').map(Number)
  const startDate = new Date(startYear, startMonth - 1, startDay)
  const endDate = new Date(endYear, endMonth - 1, endDay)
  const totalDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1)
  const bucketCount = Math.min(7, totalDays)
  const values = Array.from({ length: bucketCount }, (_, index) => {
    const bucketStart = new Date(startDate)
    bucketStart.setDate(startDate.getDate() + Math.floor(index * totalDays / bucketCount))
    const bucketEnd = new Date(startDate)
    bucketEnd.setDate(startDate.getDate() + Math.floor((index + 1) * totalDays / bucketCount) - 1)
    const bucketStartValue = `${bucketStart.getFullYear()}-${String(bucketStart.getMonth() + 1).padStart(2, '0')}-${String(bucketStart.getDate()).padStart(2, '0')}`
    const bucketEndValue = `${bucketEnd.getFullYear()}-${String(bucketEnd.getMonth() + 1).padStart(2, '0')}-${String(bucketEnd.getDate()).padStart(2, '0')}`
    const bucketItems = items.filter((item) => item.date >= bucketStartValue && item.date <= bucketEndValue)
    return {
      label: totalDays <= 7 ? new Intl.DateTimeFormat('id-ID', { weekday: 'short' }).format(bucketStart) : `${bucketStart.getDate()} ${MONTHS[bucketStart.getMonth()].slice(0, 3)}`,
      commission: bucketItems.filter((item) => item.type === 'Komisi').reduce((total, item) => total + item.amount, 0),
      expense: bucketItems.filter((item) => item.type === 'Pengeluaran').reduce((total, item) => total + item.amount, 0),
    }
  })
  const max = Math.max(1, ...values.flatMap((bucket) => [bucket.commission, bucket.expense]))
  return values.map((bucket) => ({ ...bucket, commissionPercent: bucket.commission / max * 100, expensePercent: bucket.expense / max * 100 }))
}

const reportRows = (items: Transaction[]) => items.map((item) => ({
  Tanggal: displayDate(item.date),
  Waktu: item.time,
  Jenis: item.type === 'Komisi' ? 'Pemasukan' : item.type,
  Nama: item.name,
  Kategori: item.category.replace('Komisi', 'Pemasukan'),
  Catatan: item.note,
  Jumlah: item.amount,
}))

const readAdminSession = () => {
  try {
    return window.localStorage.getItem(AUTH_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(readAdminSession)

  const handleLogin = () => {
    window.localStorage.setItem(AUTH_STORAGE_KEY, 'true')
    setIsAuthenticated(true)
  }

  const handleLogout = () => {
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
    setIsAuthenticated(false)
  }

  return isAuthenticated ? <DashboardApp onLogout={handleLogout} /> : <AdminLogin onLogin={handleLogin} />
}

function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (username.trim() === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      onLogin()
      return
    }
    setError('Username atau password salah.')
  }

  return <main className="auth-shell"><section className="auth-card" aria-labelledby="login-title"><div className="auth-brand"><span className="brand-mark">S</span><strong>Sultan</strong></div><p className="auth-eyebrow">Akses administrator</p><h1 id="login-title">Masuk ke dashboard</h1><p className="auth-description">Gunakan akun admin untuk mengelola catatan keuangan.</p><form className="auth-form" onSubmit={submit}><label htmlFor="admin-username">Username<input id="admin-username" type="text" value={username} onChange={(event) => { setUsername(event.target.value); setError('') }} autoComplete="username" autoFocus required /></label><label htmlFor="admin-password">Password<input id="admin-password" type="password" value={password} onChange={(event) => { setPassword(event.target.value); setError('') }} autoComplete="current-password" required /></label>{error && <p className="auth-error" role="alert">{error}</p>}<button className="auth-submit" type="submit">Masuk</button></form></section></main>
}

function DashboardApp({ onLogout }: { onLogout: () => void }) {
  const [page, setPage] = useState<Page>(() => new URLSearchParams(window.location.search).get('page') === 'reports' ? 'Laporan' : 'Dashboard')
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions)
  const [showModal, setShowModal] = useState(false)
  const [formType, setFormType] = useState<TransactionType>('Komisi')
  const [range, setRange] = useState<DashboardRange>('7 hari')
  const today = localToday()
  const [customStart, setCustomStart] = useState(getDateDaysBefore(today, 6))
  const [customEnd, setCustomEnd] = useState(today)
  const [reportView, setReportView] = useState<ReportView>('Transaksi')
  const [reportYear, setReportYear] = useState(String(new Date().getFullYear()))
  const [expenseNames, setExpenseNames] = useState(initialExpenseNames)
  const [traderNames, setTraderNames] = useState<string[]>(loadTraderNames)
  const [batchEntries, setBatchEntries] = useState<BatchEntry[]>([createBatchEntry('Komisi')])
  const [showNotes, setShowNotes] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [notice, setNotice] = useState('')
  const [formError, setFormError] = useState('')
  const [remoteDailyRows, setRemoteDailyRows] = useState<DailyReportRow[] | null>(null)
  const [remoteDailyTotal, setRemoteDailyTotal] = useState(0)
  const [remoteReportPage, setRemoteReportPage] = useState(1)
  const [remoteLoading, setRemoteLoading] = useState(false)
  const [remoteYearlyRows, setRemoteYearlyRows] = useState<{ month: string; commission: number; expense: number; net: number }[] | null>(null)
  const [remoteTopTraders, setRemoteTopTraders] = useState<{ name: string; amount: number }[]>([])
  const [expandedTopTraderRange, setExpandedTopTraderRange] = useState<string | null>(null)
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [showExpenseNameModal, setShowExpenseNameModal] = useState(false)
  const [expenseNameItems, setExpenseNameItems] = useState<RemoteExpenseName[]>([
    { id: 'local-solar', name: 'Solar kapal' },
    { id: 'local-transportasi', name: 'Transportasi' },
    { id: 'local-makanan', name: 'Makanan kru' },
    { id: 'local-gaji', name: 'Gaji karyawan' },
  ])
  const [expenseName, setExpenseName] = useState('')
  const [editingExpenseNameId, setEditingExpenseNameId] = useState<string | null>(null)

  const navigate = (nextPage: Page) => {
    const pageParam = nextPage === 'Laporan' ? '?page=reports' : '?page=dashboard'
    window.history.pushState({ page: nextPage }, '', pageParam)
    setPage(nextPage)
  }

  const dayCount = range === '1 hari' ? 1 : range === '7 hari' ? 7 : 30
  const rangeEnd = range === 'Custom' ? customEnd : today
  const rangeStart = range === 'Custom' ? customStart : getDateDaysBefore(rangeEnd, dayCount - 1)
  const filteredTransactions = transactions.filter((item) => item.date >= rangeStart && item.date <= rangeEnd).sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`))
  const commissions = filteredTransactions.filter((item) => item.type === 'Komisi')
  const expenses = filteredTransactions.filter((item) => item.type === 'Pengeluaran')
  const commissionTotal = commissions.reduce((total, item) => total + item.amount, 0)
  const expenseTotal = expenses.reduce((total, item) => total + item.amount, 0)
  const netTotal = commissionTotal - expenseTotal
  const localTopTraders = Array.from(new Set(commissions.map((item) => item.name))).map((name) => ({ name, amount: commissions.filter((item) => item.name === name).reduce((total, item) => total + item.amount, 0) })).sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))
  const topTraders = remoteTopTraders.length ? remoteTopTraders : localTopTraders
  const hasMoreTopTraders = topTraders.length > TOP_TRADER_PREVIEW_COUNT
  const topTraderRangeKey = `${rangeStart}:${rangeEnd}`
  const showAllTopTraders = expandedTopTraderRange === topTraderRangeKey
  const visibleTopTraders = showAllTopTraders ? topTraders : topTraders.slice(0, TOP_TRADER_PREVIEW_COUNT)
  const yearlyTransactions = transactions.filter((item) => item.date.startsWith(reportYear))
  const yearlyRows = MONTHS.map((month, index) => {
    const monthKey = `${reportYear}-${String(index + 1).padStart(2, '0')}`
    const monthItems = yearlyTransactions.filter((item) => item.date.startsWith(monthKey))
    const commission = monthItems.filter((item) => item.type === 'Komisi').reduce((total, item) => total + item.amount, 0)
    const expense = monthItems.filter((item) => item.type === 'Pengeluaran').reduce((total, item) => total + item.amount, 0)
    return { month, commission, expense, net: commission - expense }
  })
  const reportYears = Array.from(new Set([String(new Date().getFullYear()), ...transactions.map((item) => item.date.slice(0, 4))])).sort().reverse()

  useEffect(() => {
    if (!isRemoteDataAvailable) return
    let cancelled = false
    startTransition(() => setRemoteLoading(true))
    Promise.all([loadTransactions(100), loadTraders(), loadDailyReports(remoteReportPage, REPORT_DAYS_PER_PAGE)])
      .then(([transactionResult, traderResult, dailyResult]) => {
        if (cancelled) return
        if (transactionResult.error || traderResult.error || dailyResult.error) {
          setNotice('Supabase belum siap. Jalankan supabase/schema.sql lalu coba lagi.')
          return
        }
        if (transactionResult.data) setTransactions(transactionResult.data)
        if (traderResult.data) {
          const names = traderResult.data.map((trader) => trader.name)
          setTraderNames(names)
          window.localStorage.setItem('sultan-trader-names', JSON.stringify(names))
        }
        if (dailyResult.data) {
          setRemoteDailyRows(dailyResult.data)
          setRemoteDailyTotal(Number(dailyResult.data[0]?.total_days ?? 0))
        }
      })
      .catch(() => {
        if (!cancelled) setNotice('Tidak dapat memuat data Supabase. Data demo tetap ditampilkan.')
      })
      .finally(() => {
        if (!cancelled) setRemoteLoading(false)
      })
    return () => { cancelled = true }
  }, [remoteReportPage, refreshVersion])

  useEffect(() => {
    if (!isRemoteDataAvailable) return
    loadExpenseNames().then((result) => {
      if (result.data) {
        setExpenseNameItems(result.data)
        setExpenseNames(result.data.map((item) => item.name))
      }
    })
  }, [refreshVersion])

  useEffect(() => {
    if (!isRemoteDataAvailable) return
    loadYearlyReports(Number(reportYear)).then((result) => {
      if (result.data) {
        setRemoteYearlyRows(result.data.map((row) => ({
          month: MONTHS[row.report_month - 1],
          commission: Number(row.commission_total),
          expense: Number(row.expense_total),
          net: Number(row.commission_total) - Number(row.expense_total),
        })))
      }
    })
  }, [reportYear])

  useEffect(() => {
    if (!isRemoteDataAvailable) return
    loadTopTrader(rangeStart, rangeEnd).then((result) => {
      if (result.data) setRemoteTopTraders(result.data.map((row) => ({ name: row.trader_name, amount: Number(row.commission_total) })))
      else setRemoteTopTraders([])
    })
  }, [rangeStart, rangeEnd, refreshVersion])

  useEffect(() => {
    if (!showModal) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowModal(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showModal])

  useEffect(() => {
    const handlePopState = () => setPage(new URLSearchParams(window.location.search).get('page') === 'reports' ? 'Laporan' : 'Dashboard')
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const openModal = (type: TransactionType = 'Komisi') => {
    setFormType(type)
    setBatchEntries([createBatchEntry(type)])
    setShowNotes(false)
    setFormError('')
    setShowModal(true)
  }

  const changeFormType = (type: TransactionType) => {
    setFormType(type)
    setBatchEntries([createBatchEntry(type)])
    setShowNotes(false)
    setFormError('')
  }

  const formatAmount = (value: string) => {
    const digits = value.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
    return digits ? new Intl.NumberFormat('id-ID').format(Number(digits)) : ''
  }

  const updateBatchEntry = (id: string, field: keyof BatchEntry, value: string) => {
    setBatchEntries((entries) => entries.map((entry) => entry.id === id
      ? { ...entry, [field]: field === 'amount' ? formatAmount(value) : value }
      : entry))
  }

  const addBatchEntry = () => {
    setBatchEntries((entries) => [...entries, {
      ...createBatchEntry(formType),
      name: formType === 'Pengeluaran' ? (expenseNames[0] ?? NEW_EXPENSE) : '',
    }])
  }

  const removeBatchEntry = (id: string) => {
    setBatchEntries((entries) => entries.filter((entry) => entry.id !== id))
  }

  const saveTransaction = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const date = String(data.get('date'))
    const note = showNotes ? String(data.get('note') || '-').trim() || '-' : '-'
    const validEntries = batchEntries.map((entry) => ({
      ...entry,
      resolvedName: formType === 'Pengeluaran' && entry.name === NEW_EXPENSE
        ? entry.customName.trim()
        : entry.name.trim(),
      numericAmount: Number(entry.amount.replace(/\./g, '')),
    })).filter((entry) => entry.resolvedName && entry.numericAmount > 0)

    if (!date || date > TODAY) {
      setFormError('Tanggal transaksi tidak boleh kosong atau melebihi hari ini.')
      return
    }
    if (validEntries.length !== batchEntries.length || validEntries.some((entry) => !Number.isFinite(entry.numericAmount) || entry.numericAmount <= 0)) {
      setFormError('Lengkapi nama dan jumlah yang valid pada setiap baris sebelum menyimpan.')
      return
    }

    const newExpenseNames = validEntries
      .filter((entry) => formType === 'Pengeluaran' && entry.name === NEW_EXPENSE)
      .map((entry) => entry.resolvedName)
      .filter((name) => !expenseNames.includes(name))
    if (newExpenseNames.length) {
      setExpenseNames((current) => Array.from(new Set([...current, ...newExpenseNames])))
      setExpenseNameItems((current) => [...current, ...newExpenseNames.filter((name) => !current.some((item) => item.name === name)).map((name) => ({ id: `local-${Date.now()}-${name}`, name }))])
    }

    if (formType === 'Komisi') {
      const savedNames = [...traderNames]
      validEntries.forEach((entry) => {
        if (!savedNames.some((name) => name.toLocaleLowerCase('id-ID') === entry.resolvedName.toLocaleLowerCase('id-ID'))) {
          savedNames.push(entry.resolvedName)
        }
      })
      setTraderNames(savedNames)
      window.localStorage.setItem('sultan-trader-names', JSON.stringify(savedNames))
    }

    const remoteResult = await saveBatch({
      date,
      note,
      commissions: formType === 'Komisi' ? validEntries.map((entry) => ({ name: entry.resolvedName, amount: entry.numericAmount })) : [],
      expenses: formType === 'Pengeluaran' ? validEntries.map((entry) => ({ name: entry.resolvedName, amount: entry.numericAmount })) : [],
    })
    if (remoteResult.error) {
      setFormError('Data belum tersimpan ke Supabase. Pastikan schema.sql sudah dijalankan.')
      return
    }

    const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    const createdTransactions = validEntries.map((entry, index) => ({
      id: Date.now() + index,
      type: formType,
      name: entry.resolvedName,
      category: formType === 'Komisi' ? 'Pemasukan ikan' : 'Pengeluaran',
      date,
      time,
      amount: entry.numericAmount,
      note,
    }))
    setTransactions((current) => [...createdTransactions, ...current])
    form.reset()
    setBatchEntries([createBatchEntry(formType)])
    setShowNotes(false)
    setShowModal(false)
    setNotice(`${createdTransactions.length} ${formType.toLowerCase()} berhasil disimpan.`)
    if (isRemoteDataAvailable) {
      const latest = await loadTransactions(100)
      if (latest.data) setTransactions(latest.data)
      setRemoteReportPage(1)
    }
    window.setTimeout(() => setNotice(''), 3000)
  }

  const reloadAfterMutation = () => setRefreshVersion((version) => version + 1)

  const handleEditTransaction = async (transaction: Transaction) => {
    const result = await updateTransaction(transaction)
    if (result.error) {
      setNotice('Transaksi gagal diperbarui.')
      return
    }
    setTransactions((current) => current.map((item) => item.id === transaction.id ? transaction : item))
    setEditingTransaction(null)
    setNotice('Transaksi berhasil diperbarui.')
    reloadAfterMutation()
  }

  const handleDeleteTransaction = async (transaction: Transaction) => {
    if (!window.confirm(`Hapus transaksi ${transaction.name}?`)) return
    const result = await deleteTransaction({ ...transaction, id: String(transaction.id) })
    if (result.error) {
      setNotice('Transaksi gagal dihapus.')
      return
    }
    setTransactions((current) => current.filter((item) => item.id !== transaction.id))
    setNotice('Transaksi berhasil dihapus.')
    reloadAfterMutation()
  }

  const saveExpenseName = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = expenseName.trim()
    if (!name) return
    if (editingExpenseNameId) {
      const result = await updateExpenseName(editingExpenseNameId, name)
      if (result.error) {
        setNotice('Kategori gagal diperbarui.')
        return
      }
      setExpenseNameItems((current) => current.map((item) => item.id === editingExpenseNameId ? { ...item, name } : item))
      setExpenseNames((current) => current.map((item) => item === expenseNameItems.find((entry) => entry.id === editingExpenseNameId)?.name ? name : item))
    } else {
      const result = await createExpenseName(name)
      if (result.error) {
        setNotice('Kategori gagal dibuat.')
        return
      }
      const created = result.data ?? { id: `local-${Date.now()}`, name }
      setExpenseNameItems((current) => [...current, created])
      setExpenseNames((current) => [...current, created.name])
    }
    setExpenseName('')
    setEditingExpenseNameId(null)
    setNotice('Nama pengeluaran berhasil disimpan.')
    reloadAfterMutation()
  }

  const handleDeleteExpenseName = async (item: RemoteExpenseName) => {
    if (!window.confirm(`Hapus nama pengeluaran ${item.name}?`)) return
    const result = await deleteExpenseName(item.id)
    if (result.error) {
      setNotice('Nama pengeluaran gagal dihapus.')
      return
    }
    setExpenseNameItems((current) => current.filter((entry) => entry.id !== item.id))
    setExpenseNames((current) => current.filter((entry) => entry !== item.name))
    setNotice('Nama pengeluaran berhasil dihapus.')
    reloadAfterMutation()
  }

  return (
    <div className="app-shell">
      <header className="desktop-header">
        <div className="header-inner">
          <button className="brand" onClick={() => navigate("Dashboard")}>
            <span className="brand-mark">S</span>
            <strong>Sultan</strong>
          </button>
          <nav aria-label="Navigasi utama">
            <button
              className={page === "Dashboard" ? "active" : ""}
              aria-current={page === "Dashboard" ? "page" : undefined}
              onClick={() => navigate("Dashboard")}
            >
              <SquaresFour size={19} weight="bold" /> Dashboard
            </button>
            <button
              className={page === "Laporan" ? "active" : ""}
              aria-current={page === "Laporan" ? "page" : undefined}
              onClick={() => navigate("Laporan")}
            >
              <Receipt size={19} weight="bold" /> Laporan
            </button>
          </nav>
          <div className="header-actions">
            <button className="header-add" onClick={() => openModal()}>
              <Plus size={18} weight="bold" /> Catat transaksi
            </button>
            <button className="logout-button" onClick={onLogout}>
              Keluar
            </button>
          </div>
        </div>
      </header>

      <main className="main-content">
        <header className="page-heading">
          <div>
            <p>
              {new Intl.DateTimeFormat("id-ID", { dateStyle: "full" }).format(
                new Date(),
              )}
            </p>
            <h1>{page}</h1>
          </div>
          <div className="heading-actions">
            <div className="profile-menu">
              <button
                className="profile-trigger round-logo"
                type="button"
                aria-label="Buka menu profil"
                aria-haspopup="menu"
                aria-expanded={showProfileMenu}
                onClick={() => setShowProfileMenu((current) => !current)}
              >
                S
              </button>
              {showProfileMenu && (
                <div className="profile-dropdown" role="menu">
                  <span className="profile-name">Admin</span>
                  <button type="button" role="menuitem" onClick={onLogout}>
                    <SignOut size={17} /> Keluar
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {page === "Dashboard" ? (
          <>
            <section
              className="range-section"
              aria-label="Rentang data dashboard"
            >
              <div
                className="range-tabs"
                role="group"
                aria-label="Rentang dashboard"
              >
                {(
                  ["1 hari", "7 hari", "30 hari", "Custom"] as DashboardRange[]
                ).map((item) => (
                  <button
                    aria-pressed={range === item}
                    className={range === item ? "active" : ""}
                    onClick={() => setRange(item)}
                    key={item}
                  >
                    {item}
                  </button>
                ))}
              </div>
              {range === "Custom" && (
                <div className="custom-range">
                  <label htmlFor="custom-start">
                    Dari
                    <input
                      id="custom-start"
                      type="date"
                      value={customStart}
                      max={customEnd}
                      onChange={(event) =>
                        event.target.value && setCustomStart(event.target.value)
                      }
                    />
                  </label>
                  <span>sampai</span>
                  <label htmlFor="custom-end">
                    Hingga
                    <input
                      id="custom-end"
                      type="date"
                      value={customEnd}
                      min={customStart}
                      max={TODAY}
                      onChange={(event) =>
                        event.target.value && setCustomEnd(event.target.value)
                      }
                    />
                  </label>
                </div>
              )}
            </section>
            <section className="metrics" aria-label="Ringkasan keuangan">
              <article className="metric featured">
                <span>Total pemasukan</span>
                <strong>{compactRupiah(commissionTotal)}</strong>
                <div className="progress-meta">
                  <small>{rangeStart}</small>
                  <small>{rangeEnd}</small>
                </div>
                <div className="progress">
                  <i style={{ width: `${commissionTotal ? "100%" : "0%"}` }} />
                </div>
              </article>
              <article className="metric">
                <span>Total pengeluaran</span>
                <strong>{compactRupiah(expenseTotal)}</strong>
                <div className="progress-meta">
                  <small>{expenses.length}</small>
                  <small>transaksi</small>
                </div>
                <div className="progress">
                  <i style={{ width: `${expenseTotal ? "100%" : "0%"}` }} />
                </div>
              </article>
              <article className="metric">
                <span>Keuntungan bersih</span>
                <strong>{compactRupiah(netTotal)}</strong>
                <div className="progress-meta">
                  <small>
                    {commissionTotal
                      ? Math.round((netTotal / commissionTotal) * 100)
                      : 0}
                    %
                  </small>
                  <small>margin</small>
                </div>
                <div className="progress">
                  <i
                    style={{
                      width: `${commissionTotal ? Math.max(0, Math.min(100, (netTotal / commissionTotal) * 100)) : 0}%`,
                    }}
                  />
                </div>
              </article>
              <article className="metric">
                <span>Jumlah transaksi</span>
                <strong>{filteredTransactions.length}</strong>
                <div className="progress-meta">
                  <small>Periode ini</small>
                  <small>{range}</small>
                </div>
                <div className="progress">
                  <i
                    style={{
                      width: `${Math.min(filteredTransactions.length * 10, 100)}%`,
                    }}
                  />
                </div>
              </article>
            </section>
            <section
              className="top-trader-card"
              aria-label="Semua supplier berdasarkan pemasukan"
            >
              <div className="top-trader-heading">
                <span>Supplier dengan pemasukan terbanyak</span>
                <small>Semua supplier · periode yang dipilih</small>
              </div>
              {topTraders.length ? (
                <>
                  <div
                    className={`top-trader-list${hasMoreTopTraders && !showAllTopTraders ? " is-collapsed" : ""}`}
                  >
                    {visibleTopTraders.map((trader, index) => (
                      <div className="top-trader-row" key={trader.name}>
                        <span className="top-trader-rank">#{index + 1}</span>
                        <strong>{trader.name}</strong>
                        <b>{rupiah(trader.amount)}</b>
                      </div>
                    ))}
                  </div>
                  {hasMoreTopTraders && (
                    <button
                      className="top-trader-toggle"
                      type="button"
                      onClick={() =>
                        setExpandedTopTraderRange((current) =>
                          current === topTraderRangeKey
                            ? null
                            : topTraderRangeKey,
                        )
                      }
                    >
                      {showAllTopTraders
                        ? "Tampilkan lebih sedikit"
                        : `Lihat semua (${topTraders.length})`}
                    </button>
                  )}
                </>
              ) : (
                <p className="top-trader-empty">
                  Catat pemasukan untuk melihat peringkat Supplier.
                </p>
              )}
            </section>

            <section className="dashboard-grid">
              <article className="chart-section">
                <div className="section-heading">
                  <div>
                    <h2>Arus keuangan</h2>
                    <p>
                      {displayDate(rangeStart)} sampai {displayDate(rangeEnd)}
                    </p>
                  </div>
                </div>
                <div className="chart">
                  <div className="chart-labels">
                    <span>4 jt</span>
                    <span>3 jt</span>
                    <span>2 jt</span>
                    <span>1 jt</span>
                    <span>0</span>
                  </div>
                  <div
                    className="bars"
                    role="img"
                    aria-label="Grafik arus keuangan berdasarkan rentang yang dipilih"
                  >
                    {buildChartBuckets(
                      filteredTransactions,
                      rangeStart,
                      rangeEnd,
                    ).map((bucket) => (
                      <div className="bar-group" key={bucket.label}>
                        <div
                          className="bar commission-bar"
                          style={{ height: `${bucket.commissionPercent}%` }}
                        />
                        <div
                          className="bar expense-bar"
                          style={{ height: `${bucket.expensePercent}%` }}
                        />
                        <small>{bucket.label}</small>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="legend">
                  <span>
                    <i /> Pemasukan
                  </span>
                  <span>
                    <i /> Pengeluaran
                  </span>
                </div>
                <table className="chart-data-table">
                  <caption>Data arus keuangan</caption>
                  <thead>
                    <tr>
                      <th scope="col">Periode</th>
                      <th scope="col">Pemasukan</th>
                      <th scope="col">Pengeluaran</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buildChartBuckets(
                      filteredTransactions,
                      rangeStart,
                      rangeEnd,
                    ).map((bucket) => (
                      <tr key={`data-${bucket.label}`}>
                        <td>{bucket.label}</td>
                        <td>{rupiah(bucket.commission)}</td>
                        <td>{rupiah(bucket.expense)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </article>

              <article className="transaction-section">
                <div className="section-heading">
                  <div>
                    <h2>Transaksi terbaru</h2>
                    <p>Catatan yang baru dibuat</p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => navigate("Laporan")}
                  >
                    Lihat semua
                  </button>
                </div>
                <div className="transaction-list">
                  {filteredTransactions.length ? (
                    filteredTransactions.slice(0, 5).map((item) => (
                      <div className="transaction-row" key={item.id}>
                        <span className="transaction-icon">
                          {item.type === "Komisi" ? (
                            <ArrowDown size={20} weight="bold" />
                          ) : (
                            <ArrowUp size={20} weight="bold" />
                          )}
                        </span>
                        <div>
                          <strong>{item.name}</strong>
                          <small>
                            {displayDate(item.date)} · {item.time}
                          </small>
                        </div>
                        <span className="transaction-type">{item.type === "Komisi" ? "Pemasukan" : item.type}</span>
                        <b className={item.type === "Komisi" ? "transaction-amount income-amount" : "transaction-amount expense-amount"}>
                          {item.type === "Komisi" ? "+" : "-"}
                          {rupiah(item.amount)}
                        </b>
                      </div>
                    ))
                  ) : (
                    <div className="empty-list">
                      <strong>Belum ada transaksi</strong>
                      <span>Tidak ada catatan pada rentang ini.</span>
                    </div>
                  )}
                </div>
              </article>
            </section>
          </>
        ) : (
          <section className="reports">
            <div className="section-heading report-heading">
              <div>
                <h2>Laporan keuangan</h2>
                <p>Periksa transaksi atau ringkasan tahunan.</p>
              </div>
              <button
                className="secondary"
                onClick={() => setShowExpenseNameModal(true)}
              >
                Kelola nama pengeluaran
              </button>
            </div>
            <div
              className="report-tabs"
              role="group"
              aria-label="Jenis laporan"
            >
              <button
                aria-pressed={reportView === "Transaksi"}
                className={reportView === "Transaksi" ? "active" : ""}
                onClick={() => setReportView("Transaksi")}
              >
                Transaksi
              </button>
              <button
                aria-pressed={reportView === "Tahunan"}
                className={reportView === "Tahunan" ? "active" : ""}
                onClick={() => setReportView("Tahunan")}
              >
                Tahunan
              </button>
            </div>
            {reportView === "Transaksi" ? (
              <DailyReports
                transactions={transactions}
                remoteRows={remoteDailyRows}
                remoteTotal={remoteDailyTotal}
                remotePage={remoteReportPage}
                onRemotePageChange={setRemoteReportPage}
                remoteLoading={remoteLoading}
                onEdit={setEditingTransaction}
                onDelete={handleDeleteTransaction}
              />
            ) : (
              <AnnualReport
                year={reportYear}
                years={reportYears}
                onYearChange={setReportYear}
                rows={remoteYearlyRows ?? yearlyRows}
                commission={(remoteYearlyRows ?? yearlyRows).reduce(
                  (total, row) => total + row.commission,
                  0,
                )}
                expense={(remoteYearlyRows ?? yearlyRows).reduce(
                  (total, row) => total + row.expense,
                  0,
                )}
              />
            )}
          </section>
        )}
        {notice && (
          <div className="notice" role="status">
            {notice}
          </div>
        )}
      </main>

      <nav className="mobile-nav" aria-label="Navigasi mobile">
        <button
          className={page === "Dashboard" ? "active" : ""}
          onClick={() => navigate("Dashboard")}
          aria-current={page === "Dashboard" ? "page" : undefined}
        >
          <span className="mobile-nav-icon">
            <SquaresFour
              size={23}
              weight={page === "Dashboard" ? "fill" : "regular"}
            />
          </span>
          <span>Dashboard</span>
        </button>
        <button
          className="mobile-add"
          onClick={() => openModal()}
          aria-label="Tambah transaksi"
        >
          <span className="mobile-nav-icon">
            <Plus size={24} weight="bold" />
          </span>
          <span>Catat</span>
        </button>
        <button
          className={page === "Laporan" ? "active" : ""}
          onClick={() => navigate("Laporan")}
          aria-current={page === "Laporan" ? "page" : undefined}
        >
          <span className="mobile-nav-icon">
            <Receipt
              size={23}
              weight={page === "Laporan" ? "fill" : "regular"}
            />
          </span>
          <span>Laporan</span>
        </button>
      </nav>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="sr-only" aria-live="polite">
            Form pencatatan transaksi terbuka
          </div>
          <form
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="transaction-modal-title"
            onSubmit={saveTransaction}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="close"
              onClick={() => setShowModal(false)}
              aria-label="Tutup"
            >
              <X size={22} />
            </button>
            <h2 id="transaction-modal-title">Catat transaksi</h2>
            <p>Pilih jenis transaksi lalu isi data.</p>
            <div className="tabs" role="group" aria-label="Jenis transaksi">
              <button
                type="button"
                aria-pressed={formType === "Komisi"}
                className={formType === "Komisi" ? "active" : ""}
                onClick={() => changeFormType("Komisi")}
              >
                Pemasukan
              </button>
              <button
                type="button"
                aria-pressed={formType === "Pengeluaran"}
                className={formType === "Pengeluaran" ? "active" : ""}
                onClick={() => changeFormType("Pengeluaran")}
              >
                Pengeluaran
              </button>
            </div>
            <label className="transaction-date">
              Tanggal transaksi
              <input
                name="date"
                type="date"
                defaultValue={TODAY}
                autoFocus
                required
              />
            </label>
            <div className="batch-heading">
              <div>
                <strong>
                  {formType === "Komisi"
                    ? "Daftar pemasukan"
                    : "Daftar pengeluaran"}
                </strong>
                <span>Isi semua baris yang ingin disimpan sekaligus.</span>
              </div>
              <span>{batchEntries.length} baris</span>
            </div>
            <div className="batch-list">
              {batchEntries.map((entry, index) => (
                <section className="batch-row" key={entry.id}>
                  <div className="batch-row-head">
                    <strong>
                      {formType === "Komisi"
                        ? `Pemasukan ${index + 1}`
                        : `Pengeluaran ${index + 1}`}
                    </strong>
                    {batchEntries.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeBatchEntry(entry.id)}
                        aria-label={`Hapus baris ${index + 1}`}
                      >
                        <Trash size={17} />
                      </button>
                    )}
                  </div>
                  {formType === "Komisi" ? (
                    <label>
                      Nama supplier
                      <input
                        list="trader-suggestions"
                        value={entry.name}
                        onChange={(event) =>
                          updateBatchEntry(entry.id, "name", event.target.value)
                        }
                        placeholder="Ketik atau pilih nama"
                        autoComplete="off"
                        required
                      />
                    </label>
                  ) : (
                    <>
                      <label>
                        Nama pengeluaran
                        <select
                          value={entry.name}
                          onChange={(event) =>
                            updateBatchEntry(
                              entry.id,
                              "name",
                              event.target.value,
                            )
                          }
                          required
                        >
                          {expenseNames.map((expenseName) => (
                            <option value={expenseName} key={expenseName}>
                              {expenseName}
                            </option>
                          ))}
                          <option value={NEW_EXPENSE}>
                            + Buat pengeluaran baru
                          </option>
                        </select>
                      </label>
                      {entry.name === NEW_EXPENSE && (
                        <label className="new-expense-field">
                          Pengeluaran baru
                          <input
                            value={entry.customName}
                            onChange={(event) =>
                              updateBatchEntry(
                                entry.id,
                                "customName",
                                event.target.value,
                              )
                            }
                            placeholder="Contoh: Perawatan mesin"
                            required
                          />
                        </label>
                      )}
                    </>
                  )}
                  <label>
                    Jumlah
                    <div className="money-field">
                      <span>Rp</span>
                      <input
                        className="money-input"
                        type="text"
                        inputMode="numeric"
                        value={entry.amount}
                        onChange={(event) =>
                          updateBatchEntry(
                            entry.id,
                            "amount",
                            event.target.value,
                          )
                        }
                        placeholder="0"
                        required
                      />
                    </div>
                  </label>
                </section>
              ))}
            </div>
            {formType === "Komisi" && (
              <datalist id="trader-suggestions">
                {traderNames.map((traderName) => (
                  <option value={traderName} key={traderName} />
                ))}
              </datalist>
            )}
            <button
              className="add-batch-button"
              type="button"
              onClick={addBatchEntry}
            >
              <Plus size={18} weight="bold" />{" "}
              {formType === "Komisi" ? "Tambah pemasukan" : "Tambah pengeluaran"}
            </button>
            <label className="notes-toggle">
              <input
                type="checkbox"
                checked={showNotes}
                onChange={(event) => setShowNotes(event.target.checked)}
              />
              <span>Tambahkan catatan</span>
            </label>
            {showNotes && (
              <label className="notes-field">
                Catatan <span>(opsional)</span>
                <textarea
                  name="note"
                  rows={3}
                  placeholder="Tambahkan keterangan untuk transaksi ini"
                />
              </label>
            )}
            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}
            <button className="primary save-button" type="submit">
              Simpan {batchEntries.length} {formType === "Komisi" ? "pemasukan" : "pengeluaran"}
            </button>
          </form>
        </div>
      )}
      {editingTransaction && (
        <EditTransactionModal
          transaction={editingTransaction}
          onClose={() => setEditingTransaction(null)}
          onSave={handleEditTransaction}
        />
      )}
      {showExpenseNameModal && (
        <ExpenseNameModal
          items={expenseNameItems}
          value={expenseName}
          editingId={editingExpenseNameId}
          onNameChange={setExpenseName}
          onEdit={(item) => {
            setEditingExpenseNameId(item.id);
            setExpenseName(item.name);
          }}
          onDelete={handleDeleteExpenseName}
          onSave={saveExpenseName}
          onClose={() => {
            setShowExpenseNameModal(false);
            setExpenseName("");
            setEditingExpenseNameId(null);
          }}
        />
      )}
    </div>
  );
}

function DailyReports({ transactions, remoteRows, remoteTotal, remotePage, onRemotePageChange, remoteLoading, onEdit, onDelete }: { transactions: Transaction[]; remoteRows: DailyReportRow[] | null; remoteTotal: number; remotePage: number; onRemotePageChange: (page: number) => void; remoteLoading: boolean; onEdit: (transaction: Transaction) => void; onDelete: (transaction: Transaction) => void }) {
  const [currentPage, setCurrentPage] = useState(1)
  const availableMonths = Array.from(new Set(transactions.map((item) => item.date.slice(0, 7)))).sort().reverse()
  const [exportMonth, setExportMonth] = useState(availableMonths[0] ?? TODAY.slice(0, 7))
  const grouped = remoteRows
      ? remoteRows.map((row): [string, Transaction[]] => [row.report_date, [
      ...row.commission_items.map((item): Transaction => ({ id: item.id, type: 'Komisi', name: item.name, category: 'Pemasukan ikan', date: row.report_date, time: new Date(item.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }), amount: Number(item.amount), note: item.notes ?? '-' })),
      ...row.expense_items.map((item): Transaction => ({ id: item.id, type: 'Pengeluaran', name: item.name, category: 'Pengeluaran', date: row.report_date, time: new Date(item.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }), amount: Number(item.amount), note: item.notes ?? '-' })),
    ]])
    : Object.entries(transactions.reduce<Record<string, Transaction[]>>((days, item) => {
      days[item.date] = [...(days[item.date] ?? []), item]
      return days
    }, {})).sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
  const totalPages = remoteRows ? Math.max(1, Math.ceil(remoteTotal / REPORT_DAYS_PER_PAGE)) : Math.max(1, Math.ceil(grouped.length / REPORT_DAYS_PER_PAGE))
  const page = remoteRows ? remotePage : Math.min(currentPage, totalPages)
  const visibleDays = remoteRows ? grouped : grouped.slice((page - 1) * REPORT_DAYS_PER_PAGE, page * REPORT_DAYS_PER_PAGE)

  const goToPage = (nextPage: number) => {
    if (remoteRows) onRemotePageChange(nextPage)
    else setCurrentPage(nextPage)
  }

  const exportDaily = async (format: ExportFormat, date: string, items: Transaction[]) => {
    await exportReport(format, `Laporan harian ${displayDate(date)}`, `laporan-harian-${date}`, reportRows(items))
  }

  const exportMonthly = async (format: ExportFormat) => {
    const items = transactions.filter((item) => item.date.startsWith(exportMonth))
    const [year, month] = exportMonth.split('-')
    const title = `Laporan ${MONTHS[Number(month) - 1]} ${year}`
    if (format === 'pdf') {
      await exportMonthlyPdf(title, `laporan-bulanan-${exportMonth}`, items.map((item) => ({
        date: displayDate(item.date),
        type: item.type === 'Komisi' ? 'Pemasukan' : 'Pengeluaran',
        time: item.time,
        name: item.name,
        category: item.category,
        note: item.note,
        amount: item.amount,
      })))
      return
    }
    await exportReport(format, title, `laporan-bulanan-${exportMonth}`, reportRows(items))
  }

  return <section className="daily-reports">
    <div className="monthly-export"><div><strong>Export per bulan</strong><span id="month-export-help">Pilih bulan dan format laporan.</span></div><div className="export-controls"><label className="sr-only" htmlFor="report-month">Bulan laporan</label><input id="report-month" aria-describedby="month-export-help" type="month" value={exportMonth} max={TODAY.slice(0, 7)} onChange={(event) => event.target.value && setExportMonth(event.target.value)} /><ExportButtons onExport={exportMonthly} /></div></div>
    {remoteLoading ? <div className="loading-report" role="status">Memuat laporan...</div> : visibleDays.length ? visibleDays.map(([date, items]) => {
      const commissions = items.filter((item) => item.type === 'Komisi')
      const expenses = items.filter((item) => item.type === 'Pengeluaran')
      const commissionTotal = commissions.reduce((total, item) => total + item.amount, 0)
      const expenseTotal = expenses.reduce((total, item) => total + item.amount, 0)

      return <article className="daily-card" key={date}>
        <header className="daily-card-header"><div><h2>{displayDate(date)}</h2><p>{items.length} transaksi tercatat</p></div><div className="daily-card-actions"><strong className={`daily-net-header ${commissionTotal - expenseTotal >= 0 ? 'is-profit' : 'is-loss'}`}>{rupiah(commissionTotal - expenseTotal)}</strong><ExportButtons compact onExport={(format) => exportDaily(format, date, items)} /></div></header>
        <div className="daily-columns">
           <section className="daily-column income-column"><div className="daily-column-title"><span className="daily-icon"><ArrowDown size={18} weight="bold" /></span><div><h3>Pemasukan</h3><p>{commissions.length} transaksi</p></div></div><div className="daily-items">{commissions.length ? commissions.map((item) => <DailyItem item={item} sign="+" onEdit={onEdit} onDelete={onDelete} key={item.id} />) : <p className="daily-empty">Tidak ada pemasukan.</p>}</div></section>
          <section className="daily-column expense-column"><div className="daily-column-title"><span className="daily-icon"><ArrowUp size={18} weight="bold" /></span><div><h3>Pengeluaran</h3><p>{expenses.length} transaksi</p></div></div><div className="daily-items">{expenses.length ? expenses.map((item) => <DailyItem item={item} sign="-" onEdit={onEdit} onDelete={onDelete} key={item.id} />) : <p className="daily-empty">Tidak ada pengeluaran.</p>}</div></section>
        </div>
        <footer className="daily-totals"><div className="income-total"><span>Total pemasukan</span><strong>{rupiah(commissionTotal)}</strong></div><div className="expense-total"><span>Total pengeluaran</span><strong>{rupiah(expenseTotal)}</strong></div><div className={`daily-net ${commissionTotal - expenseTotal >= 0 ? 'is-profit' : 'is-loss'}`}><span>{commissionTotal - expenseTotal >= 0 ? 'Laba bersih' : 'Rugi bersih'}</span><strong>{rupiah(commissionTotal - expenseTotal)}</strong></div></footer>
      </article>
    }) : <div className="empty-report"><strong>Belum ada laporan harian</strong><p>Transaksi yang dicatat akan dikelompokkan berdasarkan tanggal.</p></div>}
    <footer className="pagination"><p>Maksimal {REPORT_DAYS_PER_PAGE} hari per halaman</p><div><button onClick={() => goToPage(Math.max(1, page - 1))} disabled={page === 1 || remoteLoading} aria-label="Halaman sebelumnya"><CaretLeft size={18} /></button><span>Halaman <strong>{page}</strong> dari {totalPages}</span><button onClick={() => goToPage(Math.min(totalPages, page + 1))} disabled={page === totalPages || remoteLoading} aria-label="Halaman berikutnya"><CaretRight size={18} /></button></div></footer>
  </section>
}

function DailyItem({ item, sign, onEdit, onDelete }: { item: Transaction; sign: '+' | '-'; onEdit: (item: Transaction) => void; onDelete: (item: Transaction) => void }) {
  return <div className="daily-item"><div><strong>{item.name}</strong><small>{item.time} · {item.category} · {item.note}</small></div><div className="daily-item-end"><b>{sign}{rupiah(item.amount)}</b><span className="item-actions"><button type="button" onClick={() => onEdit(item)} aria-label={`Edit ${item.name}`}><PencilSimple size={16} /></button><button type="button" onClick={() => onDelete(item)} aria-label={`Hapus ${item.name}`}><Trash size={16} /></button></span></div></div>
}

function EditTransactionModal({ transaction, onClose, onSave }: { transaction: Transaction; onClose: () => void; onSave: (transaction: Transaction) => Promise<void> }) {
  const [draft, setDraft] = useState(transaction)
  const [saving, setSaving] = useState(false)
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!draft.name.trim() || !Number.isFinite(draft.amount) || draft.amount <= 0 || draft.date > TODAY) return
    setSaving(true)
    await onSave({ ...draft, name: draft.name.trim(), note: draft.note.trim() || '-' })
    setSaving(false)
  }
  return <div className="modal-backdrop" onClick={onClose}><form className="modal" role="dialog" aria-modal="true" aria-labelledby="edit-modal-title" onClick={(event) => event.stopPropagation()} onSubmit={save}><button type="button" className="close" onClick={onClose} aria-label="Tutup"><X size={22} /></button><h2 id="edit-modal-title">Edit transaksi</h2><p>Perbarui data {transaction.type === 'Komisi' ? 'pemasukan' : 'pengeluaran'}.</p><label>Nama<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required /></label><div className="form-grid"><label>Tanggal<input type="date" value={draft.date} max={TODAY} onChange={(event) => setDraft({ ...draft, date: event.target.value })} required /></label><label>Jumlah<div className="money-field"><span>Rp</span><input className="money-input" type="text" inputMode="numeric" value={draft.amount ? new Intl.NumberFormat('id-ID').format(draft.amount) : ''} onChange={(event) => setDraft({ ...draft, amount: Number(event.target.value.replace(/\D/g, '')) })} required /></div></label></div><label>Catatan<textarea rows={3} value={draft.note === '-' ? '' : draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} /></label><button className="primary save-button" disabled={saving} type="submit">{saving ? 'Menyimpan...' : 'Simpan perubahan'}</button></form></div>
}

function ExpenseNameModal({ items, value, editingId, onNameChange, onEdit, onDelete, onSave, onClose }: { items: RemoteExpenseName[]; value: string; editingId: string | null; onNameChange: (value: string) => void; onEdit: (item: RemoteExpenseName) => void; onDelete: (item: RemoteExpenseName) => void; onSave: (event: React.FormEvent<HTMLFormElement>) => Promise<void>; onClose: () => void }) {
  return <div className="modal-backdrop" onClick={onClose}><form className="modal category-modal" role="dialog" aria-modal="true" aria-labelledby="expense-name-modal-title" onClick={(event) => event.stopPropagation()} onSubmit={onSave}><button type="button" className="close" onClick={onClose} aria-label="Tutup"><X size={22} /></button><h2 id="expense-name-modal-title">Kelola nama pengeluaran</h2><p>Buat daftar nama yang akan muncul pada form pengeluaran.</p><div className="category-form"><label>{editingId ? 'Ubah nama pengeluaran' : 'Nama pengeluaran baru'}<input value={value} onChange={(event) => onNameChange(event.target.value)} placeholder="Contoh: Perawatan mesin" required /></label><button className="primary" type="submit">{editingId ? 'Simpan' : 'Tambah'}</button></div><div className="category-list">{items.map((item) => <div className="category-row" key={item.id}><strong>{item.name}</strong><span><button type="button" onClick={() => onEdit(item)} aria-label={`Edit nama pengeluaran ${item.name}`}><PencilSimple size={16} /></button><button type="button" onClick={() => onDelete(item)} aria-label={`Hapus nama pengeluaran ${item.name}`}><Trash size={16} /></button></span></div>)}</div></form></div>
}

function AnnualReport({ year, years, onYearChange, rows, commission, expense }: { year: string; years: string[]; onYearChange: (year: string) => void; rows: { month: string; commission: number; expense: number; net: number }[]; commission: number; expense: number }) {
  const exportAnnual = async (format: ExportFormat) => {
    await exportReport(format, `Laporan tahunan ${year}`, `laporan-tahunan-${year}`, rows.map((row) => ({ Bulan: row.month, Pemasukan: row.commission, Pengeluaran: row.expense, 'Laba Bersih': row.net })))
  }

 return <section className="annual-report"><div className="annual-heading"><div><h2>Ringkasan {year}</h2><p>Rekap keuangan dari Januari sampai Desember.</p></div><div className="annual-actions"><label>Tahun<select value={year} onChange={(event) => onYearChange(event.target.value)}>{years.map((option) => <option key={option}>{option}</option>)}</select></label><ExportButtons onExport={exportAnnual} /></div></div><div className="annual-summary"><div><span>Total pemasukan</span><strong className="annual-income-amount">{rupiah(commission)}</strong></div><div><span>Total pengeluaran</span><strong className="annual-expense-amount">{rupiah(expense)}</strong></div><div className="annual-net"><span>Laba tahunan</span><strong>{rupiah(commission - expense)}</strong></div></div><div className="table-wrap annual-table"><table><caption className="sr-only">Ringkasan keuangan per bulan untuk tahun {year}</caption><thead><tr><th scope="col">Bulan</th><th scope="col">Pemasukan</th><th scope="col">Pengeluaran</th><th scope="col">Laba bersih</th></tr></thead><tbody>{rows.map((row) => <tr key={row.month}><td data-label="Bulan"><strong>{row.month}</strong></td><td data-label="Pemasukan" className="annual-income-amount">{rupiah(row.commission)}</td><td data-label="Pengeluaran" className="annual-expense-amount">{rupiah(row.expense)}</td><td data-label="Laba bersih" className="table-amount">{rupiah(row.net)}</td></tr>)}</tbody></table></div></section>
}

function ExportButtons({ onExport, compact = false }: { onExport: (format: ExportFormat) => Promise<void> | void; compact?: boolean }) {
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

  return <div className={compact ? 'export-buttons compact' : 'export-buttons'}><button type="button" disabled={busy !== null} onClick={() => void handleExport('pdf')} title="Export PDF" aria-label="Export PDF">{busy === 'pdf' ? '...' : <><FilePdf size={17} /><span>PDF</span></>}</button><button type="button" disabled={busy !== null} onClick={() => void handleExport('xlsx')} title="Export Excel" aria-label="Export Excel">{busy === 'xlsx' ? '...' : <><FileXls size={17} /><span>Excel</span></>}</button>{error && <span className="export-error" role="alert">{error}</span>}</div>
}

export default App
