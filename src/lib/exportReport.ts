export type ExportFormat = 'pdf' | 'xlsx'
export type ExportRow = Record<string, string | number>

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
  const pdfDocument = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const headers = rows.length ? Object.keys(rows[0]) : ['Keterangan']
  const body = rows.length
    ? rows.map((row) => headers.map((header) => String(row[header] ?? '')))
    : [['Tidak ada data']]

  pdfDocument.setFontSize(16)
  pdfDocument.text(title, 14, 16)
  autoTable(pdfDocument, {
    head: [headers],
    body,
    startY: 23,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [18, 18, 18] },
  })
  pdfDocument.save(`${fileName}.pdf`)
}
