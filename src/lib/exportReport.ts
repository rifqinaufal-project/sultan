export type ExportFormat = 'pdf' | 'xlsx'
export type ExportRow = Record<string, string | number>
export type MonthlyExportRow = {
  date: string
  type: 'Pemasukan' | 'Pengeluaran'
  time: string
  name: string
  category: string
  note: string
  amount: number
}

type StatementRow = MonthlyExportRow

const incomeColor: [number, number, number] = [23, 131, 75]
const expenseColor: [number, number, number] = [196, 61, 61]

const getAmountColor = (header: string, row: ExportRow) => {
  const type = String(row.Jenis ?? '').toLowerCase()
  const normalizedHeader = header.toLowerCase()
  if (type.includes('pengeluaran') || normalizedHeader.includes('pengeluaran')) return expenseColor
  if (type.includes('komisi') || normalizedHeader.includes('komisi') || normalizedHeader.includes('pemasukan')) return incomeColor
  return null
}

const amountHeaders = ['Jumlah', 'Komisi', 'Pemasukan', 'Pengeluaran', 'Laba Bersih']

const formatPdfValue = (header: string, value: string | number) => {
  if (!amountHeaders.includes(header) || typeof value !== 'number') return String(value ?? '')
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)
}

const formatStatementDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(`${value}T00:00:00`))
}

const drawPdfHeader = (pdfDocument: InstanceType<typeof import('jspdf').jsPDF>, title: string, period: string, printedAt: string, pageWidth: number) => {
  pdfDocument.setFillColor(247, 250, 251)
  pdfDocument.rect(0, 0, pageWidth, 43, 'F')
  pdfDocument.setFillColor(23, 131, 75)
  pdfDocument.roundedRect(14, 9, 7, 7, 1.5, 1.5, 'F')
  pdfDocument.setFillColor(52, 130, 180)
  pdfDocument.roundedRect(18, 6, 7, 7, 1.5, 1.5, 'F')
  pdfDocument.setTextColor(25, 38, 48)
  pdfDocument.setFont('helvetica', 'bold')
  pdfDocument.setFontSize(15)
  pdfDocument.text("Lapak Hj TIK MT", 29, 12);
  pdfDocument.setFont('helvetica', 'normal')
  pdfDocument.setFontSize(7)
  pdfDocument.setTextColor(101, 112, 120)
  pdfDocument.text('SEAFOOD TRADING & FINANCIAL REPORT', 29, 17)
  pdfDocument.setFont('helvetica', 'bold')
  pdfDocument.setFontSize(15)
  pdfDocument.setTextColor(25, 38, 48)
  pdfDocument.text(title, 14, 30)
  pdfDocument.setFont('helvetica', 'normal')
  pdfDocument.setFontSize(8)
  pdfDocument.setTextColor(101, 112, 120)
  pdfDocument.text(period, 14, 36)
  pdfDocument.text('Dokumen resmi', pageWidth - 14, 30, { align: 'right' })
  pdfDocument.text(printedAt, pageWidth - 14, 36, { align: 'right' })
  pdfDocument.setDrawColor(23, 131, 75)
  pdfDocument.setLineWidth(0.8)
  pdfDocument.line(14, 43, pageWidth - 14, 43)
}

const drawPdfFooter = (pdfDocument: InstanceType<typeof import('jspdf').jsPDF>, pageNumber: number, pageWidth: number, pageHeight: number) => {
  pdfDocument.setDrawColor(180, 190, 196)
  pdfDocument.setLineWidth(0.25)
  pdfDocument.line(14, pageHeight - 15, pageWidth - 14, pageHeight - 15)
  pdfDocument.setFont('helvetica', 'normal')
  pdfDocument.setFontSize(7.5)
  pdfDocument.setTextColor(101, 112, 120)
  pdfDocument.text("Lapak Hj TIK MT · Laporan keuangan", 14, pageHeight - 8);
  pdfDocument.text(`Halaman ${pageNumber}`, pageWidth - 14, pageHeight - 8, { align: 'right' })
}

const drawSummary = (pdfDocument: InstanceType<typeof import('jspdf').jsPDF>, rows: StatementRow[], startY: number, pageWidth: number) => {
  const income = rows.filter((row) => row.type === 'Pemasukan').reduce((total, row) => total + row.amount, 0)
  const expense = rows.filter((row) => row.type === 'Pengeluaran').reduce((total, row) => total + row.amount, 0)
  const cards = [
    ['Total pemasukan', formatPdfValue('Jumlah', income), [232, 247, 238] as [number, number, number], incomeColor],
    ['Total pengeluaran', formatPdfValue('Jumlah', expense), [253, 236, 236] as [number, number, number], expenseColor],
    ['Saldo bersih', formatPdfValue('Jumlah', income - expense), [235, 242, 247] as [number, number, number], [52, 98, 127] as [number, number, number]],
  ] as const
  pdfDocument.setFillColor(58, 126, 177)
  pdfDocument.rect(14, startY, pageWidth - 28, 8, 'F')
  pdfDocument.setTextColor(255, 255, 255)
  pdfDocument.setFont('helvetica', 'bold')
  pdfDocument.setFontSize(8.5)
  pdfDocument.text('RINGKASAN TRANSAKSI', 17, startY + 5.5)
  const cardWidth = (pageWidth - 32) / 3
  cards.forEach(([label, value, background, color], index) => {
    const x = 14 + index * (cardWidth + 2)
    pdfDocument.setFillColor(...background)
    pdfDocument.roundedRect(x, startY + 12, cardWidth, 19, 1.5, 1.5, 'F')
    pdfDocument.setFont('helvetica', 'normal')
    pdfDocument.setFontSize(7)
    pdfDocument.setTextColor(101, 112, 120)
    pdfDocument.text(label, x + 4, startY + 18)
    pdfDocument.setFont('helvetica', 'bold')
    pdfDocument.setFontSize(10)
    pdfDocument.setTextColor(...color)
    pdfDocument.text(value, x + 4, startY + 26)
  })
  return startY + 39
}

const aggregateRows = (rows: StatementRow[]) => Object.values(rows.reduce<Record<string, { name: string; income: number; expense: number }>>((summary, row) => {
  const current = summary[row.name] ?? { name: row.name, income: 0, expense: 0 }
  if (row.type === 'Pemasukan') current.income += row.amount
  else current.expense += row.amount
  summary[row.name] = current
  return summary
}, {})).sort((a, b) => a.name.localeCompare(b.name))

const detailRowsFor = (rows: StatementRow[]) => {
  const summaryRows = aggregateRows(rows)
  return {
    rows: [
      ...summaryRows.filter((row) => row.income > 0).map((row) => [row.name, formatPdfValue('Pemasukan', row.income), '', '']),
      ...summaryRows.filter((row) => row.expense > 0).map((row) => [row.name, '', formatPdfValue('Pengeluaran', row.expense), '']),
    ],
    income: summaryRows.reduce((total, row) => total + row.income, 0),
    expense: summaryRows.reduce((total, row) => total + row.expense, 0),
  }
}

export async function exportMonthlyPdf(title: string, fileName: string, rows: MonthlyExportRow[]) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  const pdfDocument = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = pdfDocument.internal.pageSize.getWidth()
  const pageHeight = pdfDocument.internal.pageSize.getHeight()
  const printedAt = `Dicetak ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())}`
  const period = rows.length ? `Periode ${formatStatementDate(rows[rows.length - 1].date)} s.d. ${formatStatementDate(rows[0].date)}` : 'Tidak ada transaksi tercatat'
  drawPdfHeader(pdfDocument, title, period, printedAt, pageWidth)
  let currentY = drawSummary(pdfDocument, rows, 50, pageWidth) + 8
  pdfDocument.setFont('helvetica', 'bold')
  pdfDocument.setFontSize(10)
  pdfDocument.setTextColor(25, 38, 48)
  pdfDocument.text('DETAIL TRANSAKSI PER TANGGAL', 14, currentY + 3)
  currentY += 12

  const grouped = rows.reduce<Record<string, StatementRow[]>>((dates, row) => {
    dates[row.date] = [...(dates[row.date] ?? []), row]
    return dates
  }, {})
  const dateGroups = Object.entries(grouped).sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
  for (const [date, dateRows] of dateGroups) {
    if (currentY > pageHeight - 55) {
      pdfDocument.addPage()
      drawPdfHeader(pdfDocument, title, period, printedAt, pageWidth)
      currentY = 51
    }
    pdfDocument.setFillColor(58, 126, 177)
    pdfDocument.rect(14, currentY, pageWidth - 28, 7, 'F')
    pdfDocument.setTextColor(255, 255, 255)
    pdfDocument.setFont('helvetica', 'bold')
    pdfDocument.setFontSize(8.5)
    pdfDocument.text(formatStatementDate(date), 17, currentY + 5)
    currentY += 9
    const dateDetails = detailRowsFor(dateRows)
    if (!dateDetails.rows.length) continue
    autoTable(pdfDocument, {
      head: [['Nama', 'Pemasukan', 'Pengeluaran', 'Total']],
      body: [...dateDetails.rows, ['TOTAL', formatPdfValue('Pemasukan', dateDetails.income), formatPdfValue('Pengeluaran', dateDetails.expense), formatPdfValue('Jumlah', dateDetails.income - dateDetails.expense)]],
      startY: currentY,
      margin: { left: 14, right: 14, top: 48, bottom: 18 },
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 3, textColor: [45, 45, 45], lineColor: [218, 223, 226], lineWidth: 0.2, overflow: 'linebreak', valign: 'middle' },
      headStyles: { fillColor: [235, 239, 242], textColor: [36, 48, 58], fontStyle: 'bold', halign: 'left', cellPadding: 3.5 },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: { 0: { cellWidth: 70 }, 1: { cellWidth: 38, halign: 'right' }, 2: { cellWidth: 38, halign: 'right' }, 3: { cellWidth: 38, halign: 'right' } },
      didParseCell: (data) => {
        if (data.section !== 'body') return
        if (data.row.index === dateDetails.rows.length) {
          data.cell.styles.fillColor = [235, 242, 247]
          data.cell.styles.fontStyle = 'bold'
        } else if (data.column.index === 1 && data.cell.text[0]) {
          data.cell.styles.textColor = incomeColor
          data.cell.styles.fontStyle = 'bold'
        } else if (data.column.index === 2 && data.cell.text[0]) {
          data.cell.styles.textColor = expenseColor
          data.cell.styles.fontStyle = 'bold'
        }
      },
    })
    currentY = (pdfDocument as typeof pdfDocument & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
  }
  for (let page = 1; page <= pdfDocument.getNumberOfPages(); page += 1) {
    pdfDocument.setPage(page)
    drawPdfHeader(pdfDocument, title, period, printedAt, pageWidth)
    drawPdfFooter(pdfDocument, page, pageWidth, pageHeight)
  }
  pdfDocument.save(`${fileName}.pdf`)
}

export async function exportStatementPdf(title: string, fileName: string, rows: StatementRow[]) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  const pdfDocument = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = pdfDocument.internal.pageSize.getWidth()
  const printedAt = `Dicetak ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())}`
  const pageHeight = pdfDocument.internal.pageSize.getHeight()
  const period = rows.length ? `Periode ${formatStatementDate(rows[rows.length - 1].date)} s.d. ${formatStatementDate(rows[0].date)}` : 'Tidak ada transaksi tercatat'
  drawPdfHeader(pdfDocument, title, period, printedAt, pageWidth)
  let currentY = drawSummary(pdfDocument, rows, 50, pageWidth) + 16
  pdfDocument.setFont('helvetica', 'bold')
  pdfDocument.setFontSize(10)
  pdfDocument.setTextColor(25, 38, 48)
  pdfDocument.text('DETAIL TRANSAKSI', 14, currentY + 3)
  currentY += 9

  const totals = detailRowsFor(rows)

  if (!rows.length) {
    autoTable(pdfDocument, { head: [['Nama', 'Pemasukan', 'Pengeluaran', 'Total']], body: [['Tidak ada data', '-', '-', '-']], startY: currentY, margin: { left: 14, right: 14, top: 48, bottom: 18 }, headStyles: { fillColor: [235, 239, 242], textColor: [36, 48, 58] } })
  } else {
    autoTable(pdfDocument, { head: [['Nama', 'Pemasukan', 'Pengeluaran', 'Total']], body: [...totals.rows, ['TOTAL', formatPdfValue('Pemasukan', totals.income), formatPdfValue('Pengeluaran', totals.expense), formatPdfValue('Jumlah', totals.income - totals.expense)]], startY: currentY, margin: { left: 14, right: 14, top: 48, bottom: 18 }, theme: 'grid', styles: { font: 'helvetica', fontSize: 9, cellPadding: 3.2, textColor: [45, 45, 45], lineColor: [218, 223, 226], lineWidth: 0.2, overflow: 'linebreak', valign: 'middle' }, headStyles: { fillColor: [235, 239, 242], textColor: [36, 48, 58], fontStyle: 'bold', halign: 'left', cellPadding: 3.5 }, alternateRowStyles: { fillColor: [249, 250, 251] }, columnStyles: { 0: { cellWidth: 70 }, 1: { cellWidth: 38, halign: 'right' }, 2: { cellWidth: 38, halign: 'right' }, 3: { cellWidth: 38, halign: 'right' } }, didParseCell: (data) => { if (data.section !== 'body') return; if (data.row.index === totals.rows.length) { data.cell.styles.fillColor = [235, 242, 247]; data.cell.styles.fontStyle = 'bold' } if (data.column.index === 1 && data.cell.text[0]) { data.cell.styles.textColor = incomeColor; data.cell.styles.fontStyle = 'bold' } if (data.column.index === 2 && data.cell.text[0]) { data.cell.styles.textColor = expenseColor; data.cell.styles.fontStyle = 'bold' } } })
  }
  for (let page = 1; page <= pdfDocument.getNumberOfPages(); page += 1) {
    pdfDocument.setPage(page)
    drawPdfHeader(pdfDocument, title, period, printedAt, pageWidth)
    drawPdfFooter(pdfDocument, page, pageWidth, pageHeight)
  }
  pdfDocument.save(`${fileName}.pdf`)
}

export async function exportReport(
  format: ExportFormat,
  title: string,
  fileName: string,
  rows: ExportRow[],
) {
  if (format === 'xlsx') {
    const { Workbook } = await import('exceljs')
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Laporan')
    const headers = rows.length ? Object.keys(rows[0]) : ['Keterangan']

    worksheet.columns = headers.map((header) => ({
      header,
      key: header,
      width: Math.max(16, header.length + 4),
    }))
    worksheet.addRows(rows.length ? rows : [{ Keterangan: 'Tidak ada data' }])
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF121212' },
    }

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([new Uint8Array(buffer)], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const anchor = window.document.createElement('a')
    anchor.href = url
    anchor.download = `${fileName}.xlsx`
    anchor.click()
    URL.revokeObjectURL(url)
    return
  }

  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  const headers = rows.length ? Object.keys(rows[0]) : ['Keterangan']
  const isTransactionReport = headers.includes('Tanggal') && headers.includes('Jumlah')
  const pdfDocument = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = pdfDocument.internal.pageSize.getWidth()
  const pageHeight = pdfDocument.internal.pageSize.getHeight()
  const printedAt = `Dicetak ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())}`
  const annualPeriod = headers.includes('Bulan') ? `Ringkasan tahunan ${title.replace('Laporan tahunan ', '')}` : 'Laporan keuangan'
  const body = rows.length
    ? rows.map((row) => headers.map((header) => formatPdfValue(header, row[header] ?? '')))
    : [['Tidak ada data']]

  autoTable(pdfDocument, {
    head: [headers],
    body,
    startY: 36,
    margin: { left: 14, right: 14, bottom: 18, top: 36 },
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: isTransactionReport ? 7.2 : 9, cellPadding: isTransactionReport ? 2.2 : 3, textColor: [45, 45, 45], lineColor: [218, 223, 226], lineWidth: 0.2, overflow: 'linebreak', valign: 'middle' },
    headStyles: { fillColor: [235, 239, 242], textColor: [36, 48, 58], fontStyle: 'bold', halign: 'left', cellPadding: 3, lineColor: [205, 213, 218], lineWidth: 0.25 },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: headers.reduce<Record<number, { halign?: 'left' | 'right'; cellWidth?: number }>>((styles, header, index) => {
      if (amountHeaders.includes(header)) styles[index] = { halign: 'right', cellWidth: isTransactionReport ? 25 : 43 }
      else if (isTransactionReport) {
        const widths: Record<string, number> = { Tanggal: 23, Waktu: 15, Jenis: 20, Nama: 27, Kategori: 25, Catatan: 47 }
        styles[index] = { cellWidth: widths[header] ?? 25 }
      } else if (header === 'Bulan') styles[index] = { cellWidth: 32 }
      return styles
    }, {}),
    didParseCell: (data) => {
      if (data.section !== 'body') return
      const header = headers[data.column.index]
      const row = rows[data.row.index]
      if (!row || !header) return
      const color = getAmountColor(header, row)
      if (color && amountHeaders.includes(header)) {
        data.cell.styles.textColor = color
        data.cell.styles.fontStyle = 'bold'
      }
    },
    didDrawPage: (data) => {
      drawPdfHeader(pdfDocument, title, annualPeriod, printedAt, pageWidth)
      drawPdfFooter(pdfDocument, data.pageNumber, pageWidth, pageHeight)
    },
  })
  pdfDocument.save(`${fileName}.pdf`)
}
