export type ExportFormat = 'pdf' | 'xlsx'
export type ExportRow = Record<string, string | number>
type ExcelWorkbook = import('exceljs').Workbook
type ExcelWorksheet = import('exceljs').Worksheet
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
const excelIncomeColor = 'FF17834B'
const excelExpenseColor = 'FFC43D3D'
const excelNetColor = 'FF34627F'
const excelCurrencyFormat = '"Rp" #,##0;[Red]-"Rp" #,##0'
const excelThinBorder = {
  top: { style: 'thin' as const, color: { argb: 'FFDCDCDC' } },
  left: { style: 'thin' as const, color: { argb: 'FFDCDCDC' } },
  bottom: { style: 'thin' as const, color: { argb: 'FFDCDCDC' } },
  right: { style: 'thin' as const, color: { argb: 'FFDCDCDC' } },
}

const getAmountColor = (header: string, row: ExportRow) => {
  const type = String(row.Jenis ?? '').toLowerCase()
  const normalizedHeader = header.toLowerCase()
  if (type.includes('pengeluaran') || normalizedHeader.includes('pengeluaran')) return expenseColor
  if (type.includes('komisi') || normalizedHeader.includes('komisi') || normalizedHeader.includes('pemasukan')) return incomeColor
  return null
}

const amountHeaders = ['Jumlah', 'Komisi', 'Pemasukan', 'Pengeluaran', 'Laba Bersih']

const loadBrandLogo = async () => {
  const response = await fetch(`${import.meta.env.BASE_URL}logo.png`)
  if (!response.ok) throw new Error('Logo tidak dapat dimuat')
  const blob = await response.blob()
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

const formatPdfValue = (header: string, value: string | number) => {
  if (!amountHeaders.includes(header) || typeof value !== 'number') return String(value ?? '')
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)
}

const formatStatementDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(`${value}T00:00:00`))
}

const downloadWorkbook = async (workbook: ExcelWorkbook, fileName: string) => {
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
}

const addExcelHeader = (workbook: ExcelWorkbook, worksheet: ExcelWorksheet, logo: string, title: string, period: string, endColumn: number) => {
  const end = worksheet.getColumn(endColumn).letter
  const logoId = workbook.addImage({ base64: logo, extension: 'png' })
  worksheet.addImage(logoId, { tl: { col: 0, row: 0 }, ext: { width: 54, height: 54 } })
  worksheet.mergeCells(`B1:${end}2`)
  worksheet.getCell('B1').value = 'Lapak Hj TIK MT'
  worksheet.getCell('B1').font = { bold: true, size: 16, color: { argb: 'FF141414' } }
  worksheet.getCell('B1').alignment = { vertical: 'middle' }
  worksheet.mergeCells(`A4:${end}4`)
  worksheet.getCell('A4').value = title
  worksheet.getCell('A4').font = { bold: true, size: 16, color: { argb: 'FF141414' } }
  worksheet.mergeCells(`A5:${end}5`)
  worksheet.getCell('A5').value = `${period} · Dicetak ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())}`
  worksheet.getCell('A5').font = { size: 9, color: { argb: 'FF5F5F5F' } }
  for (let column = 1; column <= endColumn; column += 1) {
    worksheet.getCell(6, column).border = { bottom: { style: 'medium', color: { argb: 'FF141414' } } }
  }
  worksheet.getRow(1).height = 24
  worksheet.getRow(2).height = 24
  worksheet.getRow(4).height = 24
  worksheet.views = [{ state: 'frozen', ySplit: 6 }]
  worksheet.pageSetup = { orientation: 'portrait', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } }
  worksheet.headerFooter.oddFooter = '&LLapak Hj TIK MT · Laporan keuangan&RHalaman &P dari &N'
}

const styleExcelSection = (worksheet: ExcelWorksheet, rowNumber: number, label: string, endColumn: number) => {
  worksheet.mergeCells(rowNumber, 1, rowNumber, endColumn)
  const cell = worksheet.getCell(rowNumber, 1)
  cell.value = label
  cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF141414' } }
  cell.alignment = { vertical: 'middle' }
  worksheet.getRow(rowNumber).height = 22
}

const styleExcelTableHeader = (worksheet: ExcelWorksheet, rowNumber: number, headers: string[]) => {
  const row = worksheet.getRow(rowNumber)
  row.values = headers
  row.height = 22
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FF232323' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEBEBEB' } }
    cell.border = excelThinBorder
    cell.alignment = { vertical: 'middle' }
  })
}

const styleExcelAmount = (worksheet: ExcelWorksheet, rowNumber: number, column: number, color: string) => {
  const cell = worksheet.getCell(rowNumber, column)
  if (typeof cell.value !== 'number') return
  cell.numFmt = excelCurrencyFormat
  cell.font = { bold: true, color: { argb: color } }
  cell.alignment = { horizontal: 'right', vertical: 'middle' }
}

const addExcelSummary = (worksheet: ExcelWorksheet, rows: StatementRow[], startRow: number) => {
  const income = rows.filter((row) => row.type === 'Pemasukan').reduce((total, row) => total + row.amount, 0)
  const expense = rows.filter((row) => row.type === 'Pengeluaran').reduce((total, row) => total + row.amount, 0)
  styleExcelSection(worksheet, startRow, 'RINGKASAN TRANSAKSI', 4)
  const summaries = [
    ['Total pemasukan', income, excelIncomeColor],
    ['Total pengeluaran', expense, excelExpenseColor],
    ['Saldo bersih', income - expense, excelNetColor],
  ] as const
  summaries.forEach(([label, value, color], index) => {
    const rowNumber = startRow + 1 + index
    worksheet.mergeCells(rowNumber, 1, rowNumber, 2)
    worksheet.mergeCells(rowNumber, 3, rowNumber, 4)
    worksheet.getCell(rowNumber, 1).value = label
    worksheet.getCell(rowNumber, 3).value = value
    worksheet.getCell(rowNumber, 1).font = { color: { argb: 'FF5F5F5F' } }
    worksheet.getCell(rowNumber, 3).numFmt = excelCurrencyFormat
    worksheet.getCell(rowNumber, 3).font = { bold: true, color: { argb: color } }
    worksheet.getCell(rowNumber, 3).alignment = { horizontal: 'right' }
    for (let column = 1; column <= 4; column += 1) {
      worksheet.getCell(rowNumber, column).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: index === 0 ? 'FFF5F5F5' : index === 1 ? 'FFEEEEEE' : 'FFE6E6E6' } }
    }
  })
  return startRow + 5
}

const addExcelStatementTable = (worksheet: ExcelWorksheet, rows: StatementRow[], startRow: number) => {
  const totals = aggregateRows(rows)
  styleExcelTableHeader(worksheet, startRow, ['Nama', 'Pemasukan', 'Pengeluaran', 'Total'])
  let rowNumber = startRow + 1
  for (const item of totals.filter((row) => row.income > 0)) {
    worksheet.addRow([item.name, item.income, '', ''])
    styleExcelAmount(worksheet, rowNumber, 2, excelIncomeColor)
    rowNumber += 1
  }
  for (const item of totals.filter((row) => row.expense > 0)) {
    worksheet.addRow([item.name, '', item.expense, ''])
    styleExcelAmount(worksheet, rowNumber, 3, excelExpenseColor)
    rowNumber += 1
  }
  if (!totals.length) {
    worksheet.addRow(['Tidak ada data', '-', '-', '-'])
    rowNumber += 1
  }
  worksheet.addRow(['TOTAL', totals.reduce((sum, row) => sum + row.income, 0), totals.reduce((sum, row) => sum + row.expense, 0), totals.reduce((sum, row) => sum + row.income - row.expense, 0)])
  const totalRow = worksheet.getRow(rowNumber)
  totalRow.font = { bold: true }
  totalRow.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6E6' } } })
  styleExcelAmount(worksheet, rowNumber, 2, excelIncomeColor)
  styleExcelAmount(worksheet, rowNumber, 3, excelExpenseColor)
  styleExcelAmount(worksheet, rowNumber, 4, excelNetColor)
  for (let current = startRow + 1; current <= rowNumber; current += 1) {
    worksheet.getRow(current).eachCell((cell) => { cell.border = excelThinBorder })
  }
  return rowNumber + 1
}

const drawPdfHeader = (pdfDocument: InstanceType<typeof import('jspdf').jsPDF>, title: string, period: string, printedAt: string, pageWidth: number, logo: string) => {
  pdfDocument.setFillColor(255, 255, 255)
  pdfDocument.rect(0, 0, pageWidth, 43, 'F')
  pdfDocument.addImage(logo, 'PNG', 14, 4.5, 12, 12)
  pdfDocument.setTextColor(20, 20, 20)
  pdfDocument.setFont('helvetica', 'bold')
  pdfDocument.setFontSize(15)
  pdfDocument.text("Lapak Hj TIK MT", 29, 12);
  pdfDocument.setFont('helvetica', 'normal')
  pdfDocument.setFontSize(7)
  pdfDocument.setTextColor(95, 95, 95)
  pdfDocument.setFont('helvetica', 'bold')
  pdfDocument.setFontSize(15)
  pdfDocument.setTextColor(20, 20, 20)
  pdfDocument.text(title, 14, 30)
  pdfDocument.setFont('helvetica', 'normal')
  pdfDocument.setFontSize(8)
  pdfDocument.setTextColor(95, 95, 95)
  pdfDocument.text(period, 14, 36)
  pdfDocument.text('Dokumen resmi', pageWidth - 14, 30, { align: 'right' })
  pdfDocument.text(printedAt, pageWidth - 14, 36, { align: 'right' })
  pdfDocument.setDrawColor(20, 20, 20)
  pdfDocument.setLineWidth(0.8)
  pdfDocument.line(14, 43, pageWidth - 14, 43)
}

const drawPdfFooter = (pdfDocument: InstanceType<typeof import('jspdf').jsPDF>, pageNumber: number, pageWidth: number, pageHeight: number) => {
  pdfDocument.setDrawColor(180, 180, 180)
  pdfDocument.setLineWidth(0.25)
  pdfDocument.line(14, pageHeight - 15, pageWidth - 14, pageHeight - 15)
  pdfDocument.setFont('helvetica', 'normal')
  pdfDocument.setFontSize(7.5)
  pdfDocument.setTextColor(95, 95, 95)
  pdfDocument.text("Lapak Hj TIK MT · Laporan keuangan", 14, pageHeight - 8);
  pdfDocument.text(`Halaman ${pageNumber}`, pageWidth - 14, pageHeight - 8, { align: 'right' })
}

const drawSummary = (pdfDocument: InstanceType<typeof import('jspdf').jsPDF>, rows: StatementRow[], startY: number, pageWidth: number) => {
  const income = rows.filter((row) => row.type === 'Pemasukan').reduce((total, row) => total + row.amount, 0)
  const expense = rows.filter((row) => row.type === 'Pengeluaran').reduce((total, row) => total + row.amount, 0)
  const cards = [
    ['Total pemasukan', formatPdfValue('Jumlah', income), [245, 245, 245] as [number, number, number], incomeColor],
    ['Total pengeluaran', formatPdfValue('Jumlah', expense), [238, 238, 238] as [number, number, number], expenseColor],
    ['Saldo bersih', formatPdfValue('Jumlah', income - expense), [230, 230, 230] as [number, number, number], [52, 98, 127] as [number, number, number]],
  ] as const
  pdfDocument.setFillColor(20, 20, 20)
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
    pdfDocument.setTextColor(95, 95, 95)
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

export async function exportStatementExcel(title: string, fileName: string, rows: StatementRow[]) {
  const [{ Workbook }, logo] = await Promise.all([import('exceljs'), loadBrandLogo()])
  const workbook = new Workbook()
  const worksheet = workbook.addWorksheet('Laporan Harian', { properties: { defaultRowHeight: 19 } })
  worksheet.columns = [{ width: 34 }, { width: 22 }, { width: 22 }, { width: 22 }]
  const period = rows.length ? `Periode ${formatStatementDate(rows[rows.length - 1].date)} s.d. ${formatStatementDate(rows[0].date)}` : 'Tidak ada transaksi tercatat'
  addExcelHeader(workbook, worksheet, logo, title, period, 4)
  const detailStart = addExcelSummary(worksheet, rows, 8)
  styleExcelSection(worksheet, detailStart, 'DETAIL TRANSAKSI', 4)
  addExcelStatementTable(worksheet, rows, detailStart + 1)
  worksheet.autoFilter = { from: { row: detailStart + 1, column: 1 }, to: { row: detailStart + 1, column: 4 } }
  await downloadWorkbook(workbook, fileName)
}

export async function exportMonthlyExcel(title: string, fileName: string, rows: MonthlyExportRow[]) {
  const [{ Workbook }, logo] = await Promise.all([import('exceljs'), loadBrandLogo()])
  const workbook = new Workbook()
  const worksheet = workbook.addWorksheet('Laporan Bulanan', { properties: { defaultRowHeight: 19 } })
  worksheet.columns = [{ width: 34 }, { width: 22 }, { width: 22 }, { width: 22 }]
  const period = rows.length ? `Periode ${formatStatementDate(rows[rows.length - 1].date)} s.d. ${formatStatementDate(rows[0].date)}` : 'Tidak ada transaksi tercatat'
  addExcelHeader(workbook, worksheet, logo, title, period, 4)
  let rowNumber = addExcelSummary(worksheet, rows, 8)
  styleExcelSection(worksheet, rowNumber, 'DETAIL TRANSAKSI PER TANGGAL', 4)
  rowNumber += 2
  const grouped = rows.reduce<Record<string, StatementRow[]>>((dates, row) => {
    dates[row.date] = [...(dates[row.date] ?? []), row]
    return dates
  }, {})
  const dateGroups = Object.entries(grouped).sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
  for (const [date, dateRows] of dateGroups) {
    styleExcelSection(worksheet, rowNumber, formatStatementDate(date), 4)
    rowNumber = addExcelStatementTable(worksheet, dateRows, rowNumber + 1) + 1
  }
  if (!dateGroups.length) {
    worksheet.mergeCells(rowNumber, 1, rowNumber, 4)
    worksheet.getCell(rowNumber, 1).value = 'Tidak ada data'
    worksheet.getCell(rowNumber, 1).alignment = { horizontal: 'center' }
  }
  await downloadWorkbook(workbook, fileName)
}

export async function exportMonthlyPdf(title: string, fileName: string, rows: MonthlyExportRow[]) {
  const [{ jsPDF }, { default: autoTable }, logo] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    loadBrandLogo(),
  ])
  const pdfDocument = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = pdfDocument.internal.pageSize.getWidth()
  const pageHeight = pdfDocument.internal.pageSize.getHeight()
  const printedAt = `Dicetak ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())}`
  const period = rows.length ? `Periode ${formatStatementDate(rows[rows.length - 1].date)} s.d. ${formatStatementDate(rows[0].date)}` : 'Tidak ada transaksi tercatat'
  drawPdfHeader(pdfDocument, title, period, printedAt, pageWidth, logo)
  let currentY = drawSummary(pdfDocument, rows, 50, pageWidth) + 8
  pdfDocument.setFont('helvetica', 'bold')
  pdfDocument.setFontSize(10)
  pdfDocument.setTextColor(20, 20, 20)
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
      drawPdfHeader(pdfDocument, title, period, printedAt, pageWidth, logo)
      currentY = 51
    }
    pdfDocument.setFillColor(20, 20, 20)
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
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 3, textColor: [45, 45, 45], lineColor: [220, 220, 220], lineWidth: 0.2, overflow: 'linebreak', valign: 'middle' },
      headStyles: { fillColor: [235, 235, 235], textColor: [35, 35, 35], fontStyle: 'bold', halign: 'left', cellPadding: 3.5 },
      alternateRowStyles: { fillColor: [249, 249, 249] },
      columnStyles: { 0: { cellWidth: 70 }, 1: { cellWidth: 38, halign: 'right' }, 2: { cellWidth: 38, halign: 'right' }, 3: { cellWidth: 38, halign: 'right' } },
      didParseCell: (data) => {
        if (data.section !== 'body') return
        if (data.row.index === dateDetails.rows.length) {
          data.cell.styles.fillColor = [230, 230, 230]
          data.cell.styles.fontStyle = 'bold'
        }
        if (data.column.index === 1 && data.cell.text[0]) {
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
    drawPdfHeader(pdfDocument, title, period, printedAt, pageWidth, logo)
    drawPdfFooter(pdfDocument, page, pageWidth, pageHeight)
  }
  pdfDocument.save(`${fileName}.pdf`)
}

export async function exportStatementPdf(title: string, fileName: string, rows: StatementRow[]) {
  const [{ jsPDF }, { default: autoTable }, logo] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    loadBrandLogo(),
  ])
  const pdfDocument = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = pdfDocument.internal.pageSize.getWidth()
  const printedAt = `Dicetak ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())}`
  const pageHeight = pdfDocument.internal.pageSize.getHeight()
  const period = rows.length ? `Periode ${formatStatementDate(rows[rows.length - 1].date)} s.d. ${formatStatementDate(rows[0].date)}` : 'Tidak ada transaksi tercatat'
  drawPdfHeader(pdfDocument, title, period, printedAt, pageWidth, logo)
  let currentY = drawSummary(pdfDocument, rows, 50, pageWidth) + 16
  pdfDocument.setFont('helvetica', 'bold')
  pdfDocument.setFontSize(10)
  pdfDocument.setTextColor(20, 20, 20)
  pdfDocument.text('DETAIL TRANSAKSI', 14, currentY + 3)
  currentY += 9

  const totals = detailRowsFor(rows)

  if (!rows.length) {
    autoTable(pdfDocument, { head: [['Nama', 'Pemasukan', 'Pengeluaran', 'Total']], body: [['Tidak ada data', '-', '-', '-']], startY: currentY, margin: { left: 14, right: 14, top: 48, bottom: 18 }, headStyles: { fillColor: [235, 235, 235], textColor: [35, 35, 35] } })
  } else {
    autoTable(pdfDocument, { head: [['Nama', 'Pemasukan', 'Pengeluaran', 'Total']], body: [...totals.rows, ['TOTAL', formatPdfValue('Pemasukan', totals.income), formatPdfValue('Pengeluaran', totals.expense), formatPdfValue('Jumlah', totals.income - totals.expense)]], startY: currentY, margin: { left: 14, right: 14, top: 48, bottom: 18 }, theme: 'grid', styles: { font: 'helvetica', fontSize: 9, cellPadding: 3.2, textColor: [45, 45, 45], lineColor: [220, 220, 220], lineWidth: 0.2, overflow: 'linebreak', valign: 'middle' }, headStyles: { fillColor: [235, 235, 235], textColor: [35, 35, 35], fontStyle: 'bold', halign: 'left', cellPadding: 3.5 }, alternateRowStyles: { fillColor: [249, 249, 249] }, columnStyles: { 0: { cellWidth: 70 }, 1: { cellWidth: 38, halign: 'right' }, 2: { cellWidth: 38, halign: 'right' }, 3: { cellWidth: 38, halign: 'right' } }, didParseCell: (data) => { if (data.section !== 'body') return; if (data.row.index === totals.rows.length) { data.cell.styles.fillColor = [230, 230, 230]; data.cell.styles.fontStyle = 'bold' } if (data.column.index === 1 && data.cell.text[0]) { data.cell.styles.textColor = incomeColor; data.cell.styles.fontStyle = 'bold' } if (data.column.index === 2 && data.cell.text[0]) { data.cell.styles.textColor = expenseColor; data.cell.styles.fontStyle = 'bold' } } })
  }
  for (let page = 1; page <= pdfDocument.getNumberOfPages(); page += 1) {
    pdfDocument.setPage(page)
    drawPdfHeader(pdfDocument, title, period, printedAt, pageWidth, logo)
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
    const [{ Workbook }, logo] = await Promise.all([import('exceljs'), loadBrandLogo()])
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Laporan', { properties: { defaultRowHeight: 19 } })
    const headers = rows.length ? Object.keys(rows[0]) : ['Keterangan']
    const isAnnual = headers.includes('Bulan')
    worksheet.columns = headers.map((header) => ({ width: header === 'Bulan' ? 20 : amountHeaders.includes(header) ? 22 : Math.max(16, header.length + 4) }))
    const period = isAnnual ? `Ringkasan tahunan ${title.replace('Laporan tahunan ', '')}` : 'Laporan keuangan'
    addExcelHeader(workbook, worksheet, logo, title, period, headers.length)
    let tableRow = 8
    if (isAnnual) {
      const income = rows.reduce((sum, row) => sum + Number(row.Pemasukan ?? 0), 0)
      const expense = rows.reduce((sum, row) => sum + Number(row.Pengeluaran ?? 0), 0)
      styleExcelSection(worksheet, tableRow, 'RINGKASAN TAHUNAN', headers.length)
      const summaries = [['Total pemasukan', income, excelIncomeColor], ['Total pengeluaran', expense, excelExpenseColor], ['Laba tahunan', income - expense, excelNetColor]] as const
      summaries.forEach(([label, value, color], index) => {
        const currentRow = tableRow + index + 1
        worksheet.getCell(currentRow, 1).value = label
        worksheet.mergeCells(currentRow, 2, currentRow, headers.length)
        worksheet.getCell(currentRow, 2).value = value
        worksheet.getCell(currentRow, 2).numFmt = excelCurrencyFormat
        worksheet.getCell(currentRow, 2).font = { bold: true, color: { argb: color } }
        worksheet.getCell(currentRow, 2).alignment = { horizontal: 'right' }
        for (let column = 1; column <= headers.length; column += 1) worksheet.getCell(currentRow, column).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: index === 0 ? 'FFF5F5F5' : index === 1 ? 'FFEEEEEE' : 'FFE6E6E6' } }
      })
      tableRow += 5
      styleExcelSection(worksheet, tableRow, 'DETAIL PER BULAN', headers.length)
      tableRow += 1
    }
    styleExcelTableHeader(worksheet, tableRow, headers)
    const dataRows = rows.length ? rows : [{ Keterangan: 'Tidak ada data' }]
    dataRows.forEach((item, index) => {
      const currentRow = tableRow + index + 1
      const worksheetRow = worksheet.getRow(currentRow)
      worksheetRow.values = headers.map((header) => item[header] ?? '')
      worksheetRow.eachCell((cell) => { cell.border = excelThinBorder })
      headers.forEach((header, columnIndex) => {
        if (!amountHeaders.includes(header)) return
        const color = getAmountColor(header, item)
        styleExcelAmount(worksheet, currentRow, columnIndex + 1, color ? `FF${color.map((channel) => channel.toString(16).padStart(2, '0')).join('').toUpperCase()}` : excelNetColor)
      })
      if (index % 2 === 1) worksheetRow.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F9F9' } } })
    })
    worksheet.autoFilter = { from: { row: tableRow, column: 1 }, to: { row: tableRow, column: headers.length } }
    await downloadWorkbook(workbook, fileName)
    return
  }

  const [{ jsPDF }, { default: autoTable }, logo] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    loadBrandLogo(),
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
    styles: { font: 'helvetica', fontSize: isTransactionReport ? 7.2 : 9, cellPadding: isTransactionReport ? 2.2 : 3, textColor: [45, 45, 45], lineColor: [220, 220, 220], lineWidth: 0.2, overflow: 'linebreak', valign: 'middle' },
    headStyles: { fillColor: [235, 235, 235], textColor: [35, 35, 35], fontStyle: 'bold', halign: 'left', cellPadding: 3, lineColor: [205, 205, 205], lineWidth: 0.25 },
    alternateRowStyles: { fillColor: [249, 249, 249] },
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
      drawPdfHeader(pdfDocument, title, annualPeriod, printedAt, pageWidth, logo)
      drawPdfFooter(pdfDocument, data.pageNumber, pageWidth, pageHeight)
    },
  })
  pdfDocument.save(`${fileName}.pdf`)
}
