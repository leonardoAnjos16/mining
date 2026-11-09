import path from "path"
import { fileURLToPath } from "url"
import { createCSV } from "../utils/csv.js"
import { readFile, writeFile } from "../utils/file.js"

type Cell = string | number

const TEMPLATE_PATH = fileURLToPath(new URL('../../src/analysis/report/index.html', import.meta.url))

export class Report {
  private tables: Record<string, { headers: string[], rows: Cell[][] }> = {}

  constructor(private outputDir: string) {}

  resolve(file: string) {
    return path.join(this.outputDir, file)
  }

  writeTable(file: string, headers: string[], data: Record<string, Cell>[]) {
    createCSV(this.resolve(file), headers, data)
    this.tables[file] = { headers, rows: data.map(row => headers.map(header => row[header])) }
  }

  writePage() {
    writeFile(this.resolve('data.js'), `window.ANALYSIS = ${JSON.stringify({ tables: this.tables })}\n`)
    writeFile(this.resolve('index.html'), readFile(TEMPLATE_PATH))
  }
}
