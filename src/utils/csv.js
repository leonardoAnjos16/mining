import { readFile, writeFile } from "./file.js"

export const parseCSV = csvFilepath => {
  const csvContent = readFile(csvFilepath)

  const [headersRow, ...valuesRows] = csvContent.split(/\r?\n/)
  const headers = headersRow.split(',')

  const parsedCSV = []
  valuesRows.forEach(row => {
    if (row != '') {
      const parsedRow = {}
      const values = row.split(',')

      if (values.length !== headers.length) {
        throw new Error('Row is either missing some values or has extra ones')
      }

      headers.forEach((header, index) => {
        parsedRow[header] = values[index]
      })

      parsedCSV.push(parsedRow)
    }
  })

  return parsedCSV
}

export const createCSV = (filepath, headers, data) => {
  const headersRow = headers.join(',')
  const valuesRows = data.map(values => headers.map(h => values[h]).join(','))
  
  const fileContent = [headersRow, ...valuesRows].join('\n')
  writeFile(filepath, fileContent)
}
