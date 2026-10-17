import path from "path"
import { parseCSV } from "../utils/csv.js"
import { fileExists } from "../utils/file.js"
import { ComparisonResult, ToolResult } from "../experiment.js"
import { createBoxPlot } from "./time.js"
import { computeToolMetrics } from "./tools.js"
import { computeAgreementMetrics } from "./agreement.js"
import { computeProjectMetrics } from "./project.js"

type AnalysisOptions = {
  output: string
}

export type CompleteResult = ComparisonResult & {
  toolConflicts: number
  otherToolConflicts: number
  toolFail: boolean
  otherToolFail: boolean
  toolEqualGroundTruth: boolean
  otherToolEqualGroundTruth: boolean
}

export const getLanguage = (filepath: string) => {
  if (filepath.endsWith('.go')) return 'go'
  if (filepath.endsWith('.java')) return 'java'
  if (filepath.endsWith('.js') || filepath.endsWith('.jsx') || filepath.endsWith('.mjs')) return 'js'
  if (filepath.endsWith('.rs')) return 'rs'

  return 'unknown'
}

const joinResults = (toolResults: ToolResult[], comparisonResults: ComparisonResult[]): CompleteResult[] => {
  const getMapKey = (project: string, mergeCommit: string, filepath: string, tool: string) =>
    `${project}##${mergeCommit}##${filepath}##${tool}`

  const toolResultsMap: Record<string, ToolResult> = {}
  toolResults.forEach(result => {
    const { project, mergeCommit, filepath, tool } = result
    toolResultsMap[getMapKey(project, mergeCommit, filepath, tool)] = result
  })

  const groundTruthComparisonResultsMap: Record<string, boolean> = {}
  comparisonResults.forEach(({ project, mergeCommit, filepath, tool, otherTool, sameNormalizedContent }) => {
    if (otherTool !== 'ground-truth') return

    groundTruthComparisonResultsMap[getMapKey(project, mergeCommit, filepath, tool)] = sameNormalizedContent
  })

  const results: CompleteResult[] = []
  comparisonResults.forEach(result => {
    const { project, mergeCommit, filepath, tool, otherTool } = result
    if (otherTool === 'ground-truth') return

    const toolMapKey = getMapKey(project, mergeCommit, filepath, tool)
    const toolResults = toolResultsMap[toolMapKey]
    const toolEqualGroundTruth = groundTruthComparisonResultsMap[toolMapKey]

    const otherToolMapKey = getMapKey(project, mergeCommit, filepath, otherTool)
    const otherToolResults = toolResultsMap[otherToolMapKey]
    const otherToolEqualGroundTruth = groundTruthComparisonResultsMap[otherToolMapKey]

    results.push({
      ...result,
      toolConflicts: toolResults.conflicts,
      otherToolConflicts: otherToolResults.conflicts,
      toolFail: toolResults.fail,
      otherToolFail: otherToolResults.fail,
      toolEqualGroundTruth,
      otherToolEqualGroundTruth
    })
  })

  return results
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
      fail: (value: string) => value === 'true',
      timeMeasurements: (value: string) => JSON.parse(value)
    },
    ';'
  )

  const comparisonResults = parseCSV<ComparisonResult>(
    comparisonResultsPaths,
    {
      sameContent: (value: string) => value === 'true',
      sameNormalizedContent: (value: string) => value === 'true'
    },
    ';'
  )

  const completeResults = joinResults(toolResults, comparisonResults)
  const outputDir = path.resolve(options.output, 'analysis')

  createBoxPlot(toolResults, outputDir)
  computeProjectMetrics(toolResults, outputDir)
  computeToolMetrics(toolResults, outputDir)
  computeAgreementMetrics(completeResults, outputDir)
}
