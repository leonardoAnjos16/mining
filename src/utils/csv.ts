import { readFile, writeFile } from "./file.js"

type Value = string | number | boolean | number[]

export const parseCSV = <T extends Record<string, Value>>(
  csvFilepath: string,
  transformers: {
    [K in keyof T]?: (value: string) => T[K]
  } = {},
  separator: string = ';'
): T[] => {
  const csvContent = readFile(csvFilepath)

  const [headersRow, ...valuesRows] = csvContent.split(/\r?\n/)
  const headers = headersRow.split(separator)

  const parsedCSV: T[] = []
  valuesRows.forEach(row => {
    if (row != '') {
      const parsedRow: Record<string, Value> = {}
      const values = row.split(separator)

      if (values.length !== headers.length) {
        throw new Error('Row is either missing some values or has extra ones')
      }

      headers.forEach((header, index) => {
        const value = values[index]
        parsedRow[header] = transformers[header]?.(value) ?? value
      })

      parsedCSV.push(parsedRow as T)
    }
  })

  return parsedCSV
}

export const createCSV = <T extends Record<string, Value>>(
  filepath: string,
  headers: readonly (keyof T)[],
  data: T[],
  transformers: {
    [K in keyof T]?: (value: T[K]) => string
  } = {},
  separator: string = ';'
) => {
  const headersRow = headers.join(separator)
  const valuesRows = data.map(values => headers.map(h => transformers[h]?.(values[h]) ?? values[h]).join(separator))
  
  const fileContent = [headersRow, ...valuesRows].join('\n')
  writeFile(filepath, fileContent)
}
