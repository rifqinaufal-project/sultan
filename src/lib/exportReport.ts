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

const drawPdfHeader = (pdfDocument: InstanceType<typeof import('jspdf').jsPDF>, title: string, printedAt: string, pageWidth: number) => {
  pdfDocument.setFillColor(247, 249, 250)
  pdfDocument.rect(0, 0, pageWidth, 27, 'F')
  pdfDocument.setDrawColor(23, 131, 75)
  pdfDocument.setLineWidth(1)
  pdfDocument.line(14, 27, pageWidth - 14, 27)
  pdfDocument.setTextColor(25, 38, 48)
  pdfDocument.setFont('helvetica', 'bold')
  pdfDocument.setFontSize(16)
  pdfDocument.text(title, 14, 12)
  pdfDocument.setFont('helvetica', 'normal')
  pdfDocument.setFontSize(8)
  pdfDocument.setTextColor(101, 112, 120)
  pdfDocument.text(printedAt, 14, 20)
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
  const grouped = rows.reduce<Record<string, MonthlyExportRow[]>>((dates, row) => {
    dates[row.date] = [...(dates[row.date] ?? []), row]
    return dates
  }, {})
  let currentY = 36

  if (!rows.length) {
    autoTable(pdfDocument, { head: [['Keterangan']], body: [['Tidak ada data']], startY: currentY, margin: { left: 14, right: 14, top: 36, bottom: 18 }, headStyles: { fillColor: [235, 239, 242], textColor: [36, 48, 58] }, didDrawPage: (data) => { drawPdfHeader(pdfDocument, title, printedAt, pageWidth); pdfDocument.setTextColor(101, 112, 120); pdfDocument.setFontSize(8); pdfDocument.text(`Sultan · Halaman ${data.pageNumber}`, pageWidth - 14, pageHeight - 8, { align: 'right' }) } })
  } else {
    for (const [date, dateRows] of Object.entries(grouped).sort(([dateA], [dateB]) => dateB.localeCompare(dateA))) {
      if (currentY > pageHeight - 42) {
        pdfDocument.addPage()
        currentY = 36
      }
      pdfDocument.setFont('helvetica', 'bold')
      pdfDocument.setFontSize(12)
      pdfDocument.setTextColor(25, 38, 48)
      pdfDocument.text(date, 14, currentY)
      currentY += 7

      for (const type of ['Pemasukan', 'Pengeluaran'] as const) {
        const typeRows = dateRows.filter((row) => row.type === type)
        if (!typeRows.length) continue
        const isIncome = type === 'Pemasukan'
        autoTable(pdfDocument, {
          head: [[type, '', '', '', ''], ['Waktu', 'Nama', 'Kategori', 'Catatan', 'Jumlah']],
          body: typeRows.map((row) => [row.time, row.name, row.category, row.note, formatPdfValue('Jumlah', row.amount)]),
          startY: currentY,
          margin: { left: 14, right: 14, top: 36, bottom: 18 },
          theme: 'grid',
          styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.5, textColor: [45, 45, 45], lineColor: [218, 223, 226], lineWidth: 0.2, overflow: 'linebreak', valign: 'middle' },
          headStyles: { fillColor: [245, 247, 248], textColor: [36, 48, 58], fontStyle: 'bold', halign: 'left', cellPadding: 3 },
          columnStyles: { 0: { cellWidth: 18 }, 1: { cellWidth: 34 }, 2: { cellWidth: 30 }, 3: { cellWidth: 66 }, 4: { cellWidth: 34, halign: 'right' } },
          didParseCell: (data) => {
            if (data.section === 'head' && data.row.index === 0) {
              data.cell.styles.fillColor = isIncome ? [232, 247, 238] : [253, 236, 236]
              data.cell.styles.textColor = isIncome ? incomeColor : expenseColor
            }
            if (data.section === 'body' && data.column.index === 4) {
              data.cell.styles.textColor = isIncome ? incomeColor : expenseColor
              data.cell.styles.fontStyle = 'bold'
            }
          },
          didDrawPage: (data) => {
            drawPdfHeader(pdfDocument, title, printedAt, pageWidth)
            pdfDocument.setTextColor(101, 112, 120)
            pdfDocument.setFont('helvetica', 'normal')
            pdfDocument.setFontSize(8)
            pdfDocument.text(`Sultan · Halaman ${data.pageNumber}`, pageWidth - 14, pageHeight - 8, { align: 'right' })
          },
        })
        currentY = (pdfDocument as typeof pdfDocument & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
      }
    }
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
      pdfDocument.setFillColor(247, 249, 250)
      pdfDocument.rect(0, 0, pageWidth, 27, 'F')
      pdfDocument.setDrawColor(23, 131, 75)
      pdfDocument.setLineWidth(1)
      pdfDocument.line(14, 27, pageWidth - 14, 27)
      pdfDocument.setTextColor(25, 38, 48)
      pdfDocument.setFont('helvetica', 'bold')
      pdfDocument.setFontSize(16)
      pdfDocument.text(title, 14, 12)
      pdfDocument.setFont('helvetica', 'normal')
      pdfDocument.setFontSize(8)
      pdfDocument.setTextColor(101, 112, 120)
      pdfDocument.text(printedAt, 14, 20)
      pdfDocument.setFont('helvetica', 'normal')
      pdfDocument.setFontSize(8)
      pdfDocument.setTextColor(101, 112, 120)
      pdfDocument.text(`Sultan · Halaman ${data.pageNumber}`, pageWidth - 14, pageHeight - 8, { align: 'right' })
    },
  })
  pdfDocument.save(`${fileName}.pdf`)
}
