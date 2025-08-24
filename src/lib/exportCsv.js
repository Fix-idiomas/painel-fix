// lib/exportCsv.js
export function exportCsv(filename, rows, headers) {
  const csvRows = []
  if (headers && headers.length) {
    csvRows.push(headers.join(','))
  } else if (rows.length) {
    csvRows.push(Object.keys(rows[0]).join(','))
  }
  for (const row of rows) {
    const vals = (headers ?? Object.keys(row)).map((h) => {
      let v = row[h]
      if (v === null || v === undefined) v = ''
      v = String(v).replace(/"/g, '""')
      if (v.search(/[,"\n]/) >= 0) v = `"${v}"`
      return v
    })
    csvRows.push(vals.join(','))
  }
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
