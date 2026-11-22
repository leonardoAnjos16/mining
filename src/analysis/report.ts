import path from "path"
import { createCSV } from "../utils/csv.js"

type Cell = string | number

export class Report {
  constructor(private outputDir: string) {}

  resolve(file: string) {
    return path.join(this.outputDir, file)
  }

  writeTable(file: string, headers: string[], data: Record<string, Cell>[]) {
    createCSV(this.resolve(file), headers, data)
  }
}
