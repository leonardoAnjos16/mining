import path from "path"
import { parseCSV } from "../utils/csv.js"
import { fileExists } from "../utils/file.js"
import { ComparisonResult, ToolResult } from "../experiment.js"
import { createBoxPlot } from "./time.js"

type AnalysisOptions = {
  output: string
}

export const computeMetrics = (resultsPath: string, options: AnalysisOptions) => {
  const toolResultsPath = path.resolve(resultsPath, 'tools.csv')
  if (!fileExists(toolResultsPath)) {
    throw new Error('Missing tool results')
  }

  const comparisonResultsPaths = path.resolve(resultsPath, 'comparisons.csv')
  if (!fileExists(comparisonResultsPaths)) {
    throw new Error('Missing comparison results')
  }

  const toolResults = parseCSV<ToolResult>(
    toolResultsPath,
    {
      conflicts: Number,
      fail: Boolean,
      timeMeasurements: (value: string) => JSON.parse(value)
    },
    ';'
  )

  const comparisonResults = parseCSV<ComparisonResult>(
    comparisonResultsPaths,
    {
      sameContent: Boolean,
      sameNormalizedContent: Boolean
    },
    ';'
  )

  const outputDir = path.resolve(options.output, 'analysis')
  createBoxPlot(toolResults, outputDir)
}
