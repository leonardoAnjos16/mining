import fs from 'fs'
import path from 'path'
import { readCSVRows } from '../utils/csv.js'
import { AnalysisData } from './cases/types.js'

const parseCell = (value: string) => value !== '' && !Number.isNaN(Number(value)) ? Number(value) : value

const findTables = (dir: string, prefix = ''): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  if (entry.name === 'cases' && !prefix) return []

  const relative = prefix ? `${prefix}/${entry.name}` : entry.name
  if (entry.isDirectory()) return findTables(path.join(dir, entry.name), relative)
  return entry.name.endsWith('.csv') ? [relative] : []
})

export const loadTables = (analysisDir: string): AnalysisData => ({
  tables: Object.fromEntries(findTables(analysisDir).sort().map(file => {
    const { headers, rows } = readCSVRows(path.join(analysisDir, file))
    return [file, { headers, rows: rows.map(row => row.map(parseCell)) }]
  }))
})
