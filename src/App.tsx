import { startTransition, useEffect, useState } from 'react'
import { Plus, Receipt, SignOut, SquaresFour } from '@phosphor-icons/react'
import { createExpenseName, deleteExpenseName, deleteTransaction, deleteTransactionsByDate, isRemoteDataAvailable, loadDailyReports, loadExpenseNames, loadTransactions, loadTransactionsForPeriod, loadTopTrader, loadTraders, loadYearlyReports, saveBatch, updateExpenseName, updateTransaction, type DailyReportRow, type RemoteExpenseName } from './lib/financeRepository'
import { AdminLogin } from './components/auth/AdminLogin'
import { DashboardOverview } from './components/dashboard/DashboardOverview'
import { AnnualReport, DailyReports } from './components/reports/Reports'
import { EditTransactionModal, ExpenseNameModal } from './components/transactions/ManagementModals'
import { NEW_EXPENSE, TransactionModal } from './components/transactions/TransactionModal'
import { Button } from './components/ui/Button'
import { SegmentedControl } from './components/ui/SegmentedControl'
import { cn } from './lib/cn'
import { displayDate, getDateDaysBefore, localToday, MONTHS, TODAY } from './lib/formatters'
import type { BatchEntry, DashboardRange, Page, ReportView, Transaction, TransactionType } from './types/finance'

const initialTransactions: Transaction[] = [
  { id: 1, type: 'Komisi', name: 'Budi Santoso', category: 'Pemasukan ikan', date: '2026-09-05', time: '08:42', amount: 2850000, note: 'Setoran ikan tongkol' },
  { id: 2, type: 'Pengeluaran', name: 'Solar kapal', category: 'Operasional', date: '2026-09-05', time: '07:15', amount: 640000, note: 'Kebutuhan melaut' },
  { id: 3, type: 'Komisi', name: 'Siti Rahma', category: 'Pemasukan ikan', date: '2026-09-04', time: '16:20', amount: 1975000, note: 'Setoran ikan cakalang' },
  { id: 4, type: 'Pengeluaran', name: 'Transportasi', category: 'Transportasi', date: '2026-09-04', time: '13:05', amount: 275000, note: 'Pengiriman ke pasar' },
]

const REPORT_DAYS_PER_PAGE = 7
const TOP_TRADER_PREVIEW_COUNT = 5
const AUTH_STORAGE_KEY = 'sultan-admin-authenticated'
const LOCAL_TRANSACTIONS_KEY = 'sultan-local-transactions'
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

const createBatchEntry = (type: TransactionType, expenseOptions = initialExpenseNames): BatchEntry => ({
  id: crypto.randomUUID(),
  name: type === 'Pengeluaran' ? (expenseOptions[0] ?? NEW_EXPENSE) : '',
  customName: '',
  amount: '',
})

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
  return { max, values: values.map((bucket) => ({ ...bucket, commissionPercent: bucket.commission / max * 100, expensePercent: bucket.expense / max * 100 })) }
}

const readAdminSession = () => {
  try {
    return window.localStorage.getItem(AUTH_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

const loadLocalTransactions = () => {
  try {
    const saved = window.localStorage.getItem(LOCAL_TRANSACTIONS_KEY)
    return saved ? JSON.parse(saved) as Transaction[] : initialTransactions
  } catch {
    return initialTransactions
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

function DashboardApp({ onLogout }: { onLogout: () => void }) {
  const [page, setPage] = useState<Page>(() => new URLSearchParams(window.location.search).get('page') === 'reports' ? 'Laporan' : 'Dashboard')
  const [transactions, setTransactions] = useState<Transaction[]>(() => isRemoteDataAvailable ? initialTransactions : loadLocalTransactions())
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
  const [remoteYearlyLoading, setRemoteYearlyLoading] = useState(false)
  const [remoteTopTraders, setRemoteTopTraders] = useState<{ name: string; amount: number }[]>([])
  const [expandedTopTraderRange, setExpandedTopTraderRange] = useState<string | null>(null)
  const [expandedTopExpenseRange, setExpandedTopExpenseRange] = useState<string | null>(null)
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
  const [savingTransaction, setSavingTransaction] = useState(false)

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
  const localTopTraders = Array.from(new Set(commissions.map((item) => item.name))).map((name) => ({ name, amount: commissions.filter((item) => item.name === name).reduce((total, item) => total + item.amount, 0) })).sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))
  const topTraders = remoteTopTraders.length ? remoteTopTraders : localTopTraders
  const hasMoreTopTraders = topTraders.length > TOP_TRADER_PREVIEW_COUNT
  const topTraderRangeKey = `${rangeStart}:${rangeEnd}`
  const showAllTopTraders = expandedTopTraderRange === topTraderRangeKey
  const visibleTopTraders = showAllTopTraders ? topTraders : topTraders.slice(0, TOP_TRADER_PREVIEW_COUNT)
  const topExpenses = Array.from(new Set(expenses.map((item) => item.name))).map((name) => ({ name, amount: expenses.filter((item) => item.name === name).reduce((total, item) => total + item.amount, 0) })).sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))
  const hasMoreTopExpenses = topExpenses.length > TOP_TRADER_PREVIEW_COUNT
  const showAllTopExpenses = expandedTopExpenseRange === topTraderRangeKey
  const visibleTopExpenses = showAllTopExpenses ? topExpenses : topExpenses.slice(0, TOP_TRADER_PREVIEW_COUNT)
  const yearlyTransactions = transactions.filter((item) => item.date.startsWith(reportYear))
  const yearlyRows = MONTHS.map((month, index) => {
    const monthKey = `${reportYear}-${String(index + 1).padStart(2, '0')}`
    const monthItems = yearlyTransactions.filter((item) => item.date.startsWith(monthKey))
    const commission = monthItems.filter((item) => item.type === 'Komisi').reduce((total, item) => total + item.amount, 0)
    const expense = monthItems.filter((item) => item.type === 'Pengeluaran').reduce((total, item) => total + item.amount, 0)
    return { month, commission, expense, net: commission - expense }
  })
  const reportYears = Array.from(new Set([String(new Date().getFullYear()), ...transactions.map((item) => item.date.slice(0, 4))])).sort().reverse()
  const chartData = buildChartBuckets(filteredTransactions, rangeStart, rangeEnd)

  useEffect(() => {
    if (!isRemoteDataAvailable) return
    let cancelled = false
    startTransition(() => setRemoteLoading(true))
    Promise.all([loadTransactions(), loadTransactionsForPeriod(rangeStart, rangeEnd), loadTraders(), loadDailyReports(remoteReportPage, REPORT_DAYS_PER_PAGE)])
      .then(([transactionResult, periodTransactionResult, traderResult, dailyResult]) => {
        if (cancelled) return
        if (transactionResult.error || periodTransactionResult.error || traderResult.error || dailyResult.error) {
          setNotice('Data belum dapat dimuat. Periksa koneksi lalu coba lagi.')
          return
        }
        if (page === 'Dashboard' && periodTransactionResult.data) setTransactions(periodTransactionResult.data)
        else if (transactionResult.data) setTransactions(transactionResult.data)
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
        if (!cancelled) setNotice('Tidak dapat memuat data. Periksa koneksi lalu coba lagi.')
      })
      .finally(() => {
        if (!cancelled) setRemoteLoading(false)
      })
    return () => { cancelled = true }
  }, [page, rangeStart, rangeEnd, remoteReportPage, refreshVersion])

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
    let cancelled = false
    startTransition(() => setRemoteYearlyRows(null))
    startTransition(() => setRemoteYearlyLoading(true))
    loadYearlyReports(Number(reportYear)).then((result) => {
      if (cancelled) return
      if (result.data) {
        setRemoteYearlyRows(result.data.map((row) => ({
          month: MONTHS[row.report_month - 1],
          commission: Number(row.commission_total),
          expense: Number(row.expense_total),
          net: Number(row.commission_total) - Number(row.expense_total),
        })))
      }
    }).finally(() => {
      if (!cancelled) setRemoteYearlyLoading(false)
    })
    return () => { cancelled = true }
  }, [reportYear, refreshVersion])

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
      if (event.key === 'Escape') {
        const hasDraft = batchEntries.some((entry) => entry.amount || entry.customName) || showNotes
        if (!hasDraft || window.confirm('Data yang sudah diisi akan dihapus. Tutup form?')) setShowModal(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [batchEntries, showModal, showNotes])

  useEffect(() => {
    const handlePopState = () => setPage(new URLSearchParams(window.location.search).get('page') === 'reports' ? 'Laporan' : 'Dashboard')
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const openModal = (type: TransactionType = 'Komisi') => {
    setFormType(type)
    setBatchEntries([createBatchEntry(type, expenseNames)])
    setShowNotes(false)
    setFormError('')
    setShowModal(true)
  }

  const changeFormType = (type: TransactionType) => {
    if (type === formType) return
    const hasDraft = batchEntries.some((entry) => entry.amount || entry.customName) || showNotes
    if (hasDraft && !window.confirm('Data yang sudah diisi akan dihapus. Lanjutkan?')) return
    setFormType(type)
    setBatchEntries([createBatchEntry(type, expenseNames)])
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

  const closeTransactionModal = () => {
    const hasDraft = batchEntries.some((entry) => entry.amount || entry.customName) || showNotes
    if (hasDraft && !window.confirm('Data yang sudah diisi akan dihapus. Tutup form?')) return
    setShowModal(false)
  }

  const saveTransaction = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (savingTransaction) return
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

    setSavingTransaction(true)
    try {
      const remoteResult = await saveBatch({
        date,
        note,
        commissions: formType === 'Komisi' ? validEntries.map((entry) => ({ name: entry.resolvedName, amount: entry.numericAmount })) : [],
        expenses: formType === 'Pengeluaran' ? validEntries.map((entry) => ({ name: entry.resolvedName, amount: entry.numericAmount })) : [],
      })
      if (remoteResult.error) {
        setFormError('Data belum tersimpan. Periksa koneksi lalu coba lagi.')
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
      setTransactions((current) => {
        const updated = [...createdTransactions, ...current]
        if (!isRemoteDataAvailable) window.localStorage.setItem(LOCAL_TRANSACTIONS_KEY, JSON.stringify(updated))
        return updated
      })
      form.reset()
      setBatchEntries([createBatchEntry(formType, expenseNames)])
      setShowNotes(false)
      setShowModal(false)
      setNotice(`${createdTransactions.length} ${formType === 'Komisi' ? 'pemasukan' : 'pengeluaran'} berhasil disimpan.`)
      if (isRemoteDataAvailable) {
        const latest = await loadTransactions()
        if (latest.data) setTransactions(latest.data)
        setRemoteReportPage(1)
      }
      reloadAfterMutation()
      window.setTimeout(() => setNotice(''), 3000)
    } finally {
      setSavingTransaction(false)
    }
  }

  const reloadAfterMutation = () => setRefreshVersion((version) => version + 1)

  const handleEditTransaction = async (transaction: Transaction) => {
    const result = await updateTransaction(transaction)
    if (result.error) {
      setNotice('Transaksi gagal diperbarui.')
      return
    }
    setTransactions((current) => {
      const updated = current.map((item) => item.id === transaction.id ? transaction : item)
      if (!isRemoteDataAvailable) window.localStorage.setItem(LOCAL_TRANSACTIONS_KEY, JSON.stringify(updated))
      return updated
    })
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
    setTransactions((current) => {
      const updated = current.filter((item) => item.id !== transaction.id)
      if (!isRemoteDataAvailable) window.localStorage.setItem(LOCAL_TRANSACTIONS_KEY, JSON.stringify(updated))
      return updated
    })
    setNotice('Transaksi berhasil dihapus.')
    setRemoteReportPage(1)
    reloadAfterMutation()
  }

  const handleDeleteDay = async (date: string, items: Transaction[]) => {
    const formattedDate = displayDate(date)
    if (!window.confirm(`Hapus semua ${items.length} transaksi pada ${formattedDate}? Tindakan ini tidak dapat dibatalkan.`)) return
    const result = await deleteTransactionsByDate(date)
    if (result.error) {
      setNotice(`Semua transaksi pada ${formattedDate} gagal dihapus.`)
      return
    }
    setTransactions((current) => {
      const updated = current.filter((item) => item.date !== date)
      if (!isRemoteDataAvailable) window.localStorage.setItem(LOCAL_TRANSACTIONS_KEY, JSON.stringify(updated))
      return updated
    })
    setNotice(`${items.length} transaksi pada ${formattedDate} berhasil dihapus.`)
    setRemoteReportPage(1)
    reloadAfterMutation()
    window.setTimeout(() => setNotice(''), 3000)
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
    <div className="min-h-screen bg-zinc-100 text-zinc-900">
      <header className="hidden h-[72px] border-b border-zinc-200 bg-white sm:block">
        <div className="mx-auto grid h-full w-full max-w-[1228px] grid-cols-[1fr_auto_1fr] items-center gap-6 px-6">
          <button className="flex items-center gap-2.5" onClick={() => navigate('Dashboard')}>
            <img className="size-10 rounded-full object-cover" src="/logo.png" alt="Logo Lapak Hj TIK MT" />
            <strong className="font-display text-lg font-extrabold">Lapak Hj TIK MT</strong>
          </button>
          <nav className="flex gap-1" aria-label="Navigasi utama">
            <button className={cn('flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950', page === 'Dashboard' && 'bg-zinc-100 text-zinc-950')} aria-current={page === 'Dashboard' ? 'page' : undefined} onClick={() => navigate('Dashboard')}>
              <SquaresFour size={19} weight="bold" /> Dashboard
            </button>
            <button className={cn('flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950', page === 'Laporan' && 'bg-zinc-100 text-zinc-950')} aria-current={page === 'Laporan' ? 'page' : undefined} onClick={() => navigate('Laporan')}>
              <Receipt size={19} weight="bold" /> Laporan
            </button>
          </nav>
          <div className="flex justify-self-end gap-2">
            <Button onClick={() => openModal()}><Plus size={18} weight="bold" />Catat transaksi</Button>
            <Button variant="secondary" onClick={onLogout}>Keluar</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1228px] px-4 pb-32 pt-7 sm:px-6 sm:pb-20 sm:pt-10">
        <header className="flex items-center justify-between">
          <div>
            <p className="hidden text-xs text-zinc-500 sm:block">{new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' }).format(new Date())}</p>
            <h1 className="font-display text-3xl font-extrabold tracking-tight sm:mt-2 sm:text-4xl">{page}</h1>
          </div>
          <div className="relative sm:hidden">
              <button className="size-11 overflow-hidden rounded-full" type="button" aria-label="Buka menu profil" aria-haspopup="menu" aria-expanded={showProfileMenu} onClick={() => setShowProfileMenu((current) => !current)}>
                <img className="size-full object-cover" src="/logo.png" alt="Logo Lapak Hj TIK MT" />
              </button>
              {showProfileMenu && (
                <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 min-w-40 rounded-xl border border-zinc-200 bg-white p-2 shadow-xl shadow-zinc-950/10" role="menu">
                  <span className="block px-3 py-2 text-xs font-bold text-zinc-500">Admin</span>
                  <button className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-sm font-bold hover:bg-zinc-100" type="button" role="menuitem" onClick={onLogout}>
                    <SignOut size={17} /> Keluar
                  </button>
                </div>
              )}
          </div>
        </header>

        {page === 'Dashboard' ? (
          <DashboardOverview
            range={range}
            customStart={customStart}
            customEnd={customEnd}
            today={TODAY}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            commissionTotal={commissionTotal}
            expenseTotal={expenseTotal}
            transactions={filteredTransactions}
            topTraders={topTraders}
            topExpenses={topExpenses}
            visibleTopTraders={visibleTopTraders}
            hasMoreTopTraders={hasMoreTopTraders}
            showAllTopTraders={showAllTopTraders}
            visibleTopExpenses={visibleTopExpenses}
            hasMoreTopExpenses={hasMoreTopExpenses}
            showAllTopExpenses={showAllTopExpenses}
            chart={chartData}
            onRangeChange={setRange}
            onCustomStartChange={setCustomStart}
            onCustomEndChange={setCustomEnd}
            onToggleTopTraders={() => setExpandedTopTraderRange((current) => current === topTraderRangeKey ? null : topTraderRangeKey)}
            onToggleTopExpenses={() => setExpandedTopExpenseRange((current) => current === topTraderRangeKey ? null : topTraderRangeKey)}
            onAddTransaction={openModal}
            onViewReports={() => navigate('Laporan')}
          />
        ) : (
          <section className="mt-9">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="font-display text-xl font-extrabold tracking-tight">Laporan keuangan</h2>
                <p className="mt-1 text-sm text-zinc-500">Periksa transaksi atau ringkasan tahunan.</p>
              </div>
              <Button variant="secondary" onClick={() => setShowExpenseNameModal(true)}>Kelola nama pengeluaran</Button>
            </div>
            <div className="my-6"><SegmentedControl value={reportView} options={['Transaksi', 'Tahunan']} onChange={setReportView} label="Jenis laporan" /></div>
            {reportView === 'Transaksi' ? (
              <DailyReports
                transactions={transactions}
                remoteRows={remoteDailyRows}
                remoteTotal={remoteDailyTotal}
                remotePage={remoteReportPage}
                onRemotePageChange={setRemoteReportPage}
                remoteLoading={remoteLoading}
                onEdit={setEditingTransaction}
                onDelete={handleDeleteTransaction}
                onDeleteDay={handleDeleteDay}
              />
            ) : (
              <AnnualReport
                year={reportYear}
                years={reportYears}
                onYearChange={setReportYear}
                rows={remoteYearlyRows ?? yearlyRows}
                loading={remoteYearlyLoading}
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
          <div className="fixed bottom-24 right-4 z-40 max-w-sm rounded-xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white shadow-xl sm:bottom-6" role="status">{notice}</div>
        )}
      </main>

      <nav className="fixed bottom-[max(0.625rem,env(safe-area-inset-bottom))] left-3 right-3 z-30 grid h-[76px] grid-cols-3 gap-1 rounded-[22px] border border-zinc-800 bg-zinc-950 p-2 text-zinc-400 shadow-2xl sm:hidden" aria-label="Navigasi mobile">
        <button
          className={cn('flex flex-col items-center justify-center gap-1 rounded-2xl text-xs font-semibold', page === 'Dashboard' && 'bg-zinc-800 text-white')}
          onClick={() => navigate('Dashboard')}
          aria-current={page === 'Dashboard' ? 'page' : undefined}
        >
          <SquaresFour size={23} weight={page === 'Dashboard' ? 'fill' : 'regular'} />
          <span>Dashboard</span>
        </button>
        <button className="flex flex-col items-center justify-center gap-1 rounded-2xl text-xs font-semibold text-white" onClick={() => openModal()} aria-label="Tambah transaksi">
          <span className="grid h-9 w-10 place-items-center rounded-xl bg-white text-zinc-950"><Plus size={23} weight="bold" /></span>
          <span>Catat</span>
        </button>
        <button
          className={cn('flex flex-col items-center justify-center gap-1 rounded-2xl text-xs font-semibold', page === 'Laporan' && 'bg-zinc-800 text-white')}
          onClick={() => navigate('Laporan')}
          aria-current={page === 'Laporan' ? 'page' : undefined}
        >
          <Receipt size={23} weight={page === 'Laporan' ? 'fill' : 'regular'} />
          <span>Laporan</span>
        </button>
      </nav>

      {showModal && (
        <TransactionModal
          formType={formType}
          entries={batchEntries}
          expenseNames={expenseNames}
          traderNames={traderNames}
          showNotes={showNotes}
          error={formError}
          saving={savingTransaction}
          onClose={closeTransactionModal}
          onTypeChange={changeFormType}
          onEntryChange={updateBatchEntry}
          onAddEntry={addBatchEntry}
          onRemoveEntry={removeBatchEntry}
          onShowNotesChange={setShowNotes}
          onSubmit={saveTransaction}
        />
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

export default App
