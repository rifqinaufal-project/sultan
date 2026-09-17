export type Page = 'Dashboard' | 'Laporan'
export type TransactionType = 'Komisi' | 'Pengeluaran'
export type DashboardRange = '1 hari' | '7 hari' | '30 hari' | 'Custom'
export type ReportView = 'Transaksi' | 'Tahunan'

export type BatchEntry = {
  id: string
  name: string
  customName: string
  amount: string
}

export type Transaction = {
  id: number | string
  type: TransactionType
  name: string
  category: string
  date: string
  time: string
  amount: number
  note: string
}

export type AnnualReportRow = {
  month: string
  commission: number
  expense: number
  net: number
}
