import { appendFile, readFile, writeFile } from "./file.js"

type Value = string | number | boolean | number[]

export const readCSVRows = (csvFilepath: string, separator: string = ';') => {
  const [headersRow, ...valuesRows] = readFile(csvFilepath).split(/\r?\n/)
  const headers = headersRow.split(separator)

  const rows = valuesRows.filter(row => row !== '').map(row => {
    const values = row.split(separator)
    if (values.length !== headers.length) {
      throw new Error('Row is either missing some values or has extra ones')
    }
    return values
  })

  return { headers, rows }
}

export const parseCSV = <T extends Record<string, Value>>(
  csvFilepath: string,
  transformers: {
    [K in keyof T]?: (value: string) => T[K]
  } = {},
  separator: string = ';'
): T[] => {
  const { headers, rows } = readCSVRows(csvFilepath, separator)

  return rows.map(values => {
    const parsedRow: Record<string, Value> = {}
    headers.forEach((header, index) => {
      const value = values[index]
      parsedRow[header] = transformers[header]?.(value) ?? value
    })
    return parsedRow as T
  })
}

type Transformers<T> = {
  [K in keyof T]?: (value: T[K]) => string
}

const formatRows = <T extends Record<string, Value>>(
  headers: readonly (keyof T)[],
  data: T[],
  transformers: Transformers<T>,
  separator: string
) => data.map(values => headers.map(h => transformers[h]?.(values[h]) ?? values[h]).join(separator))

// Every row ends with a newline, so rows can always be appended to the end of the file
const toLines = (rows: string[]) => rows.length > 0 ? `${rows.join('\n')}\n` : ''

export const createCSV = <T extends Record<string, Value>>(
  filepath: string,
  headers: readonly (keyof T)[],
  data: T[],
  transformers: Transformers<T> = {},
  separator: string = ';'
) => {
  const headersRow = headers.join(separator)
  const valuesRows = formatRows(headers, data, transformers, separator)

  writeFile(filepath, toLines([headersRow, ...valuesRows]))
}

export const appendCSV = <T extends Record<string, Value>>(
  filepath: string,
  headers: readonly (keyof T)[],
  data: T[],
  transformers: Transformers<T> = {},
  separator: string = ';'
) => {
  if (data.length === 0) return

  const valuesRows = formatRows(headers, data, transformers, separator)
  appendFile(filepath, toLines(valuesRows))
}
