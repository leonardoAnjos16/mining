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

export type AnalyzedToolResult = ToolResult & {
  comparable: boolean
  equalGroundTruth: boolean
}

export type CompleteResult = ComparisonResult & {
  sameSides: boolean
  toolConflicts: number
  otherToolConflicts: number
  toolEqualGroundTruth: boolean
  otherToolEqualGroundTruth: boolean
}

const SUBSETS = [
  { name: 'all', include: (_sameSides: boolean) => true },
  { name: 'different-sides', include: (sameSides: boolean) => !sameSides },
  { name: 'same-sides', include: (sameSides: boolean) => sameSides }
]

export const getLanguage = (filepath: string) => {
  if (filepath.endsWith('.go')) return 'go'
  if (filepath.endsWith('.java')) return 'java'
  if (filepath.endsWith('.js') || filepath.endsWith('.jsx') || filepath.endsWith('.mjs')) return 'js'
  if (filepath.endsWith('.rs')) return 'rs'

  return 'unknown'
}

const getScenarioKey = ({ project, mergeCommit, filepath }: { project: string, mergeCommit: string, filepath: string }) =>
  `${project}##${mergeCommit}##${filepath}`

const getToolKey = (result: { project: string, mergeCommit: string, filepath: string }, tool: string) =>
  `${getScenarioKey(result)}##${tool}`

const analyzeToolResults = (toolResults: ToolResult[], comparisonResults: ComparisonResult[]): AnalyzedToolResult[] => {
  const failedScenarios = new Set(toolResults.filter(({ fail }) => fail).map(getScenarioKey))

  const equalGroundTruth = new Map<string, boolean>()
  comparisonResults.forEach(result => {
    if (result.otherTool === 'ground-truth') {
      equalGroundTruth.set(getToolKey(result, result.tool), result.sameNormalizedContent)
    }
  })

  return toolResults.map(result => ({
    ...result,
    comparable: !failedScenarios.has(getScenarioKey(result)),
    equalGroundTruth: equalGroundTruth.get(getToolKey(result, result.tool)) ?? false
  }))
}

const joinResults = (toolResults: AnalyzedToolResult[], comparisonResults: ComparisonResult[]): CompleteResult[] => {
  const toolResultsMap = new Map(toolResults.map(result => [getToolKey(result, result.tool), result]))

  const results: CompleteResult[] = []
  comparisonResults.forEach(result => {
    if (result.otherTool === 'ground-truth') return

    const toolResult = toolResultsMap.get(getToolKey(result, result.tool))
    const otherToolResult = toolResultsMap.get(getToolKey(result, result.otherTool))

    if (!toolResult || !otherToolResult) {
      throw new Error(`Missing tool results for ${getScenarioKey(result)}`)
    }

    if (!toolResult.comparable) return

    results.push({
      ...result,
      sameSides: toolResult.sameSides,
      toolConflicts: toolResult.conflicts,
      otherToolConflicts: otherToolResult.conflicts,
      toolEqualGroundTruth: toolResult.equalGroundTruth,
      otherToolEqualGroundTruth: otherToolResult.equalGroundTruth
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
      sameSides: (value: string) => value === 'true',
      fail: (value: string) => value === 'true',
      timeout: (value: string) => value === 'true',
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

  const analyzedToolResults = analyzeToolResults(toolResults, comparisonResults)
  const completeResults = joinResults(analyzedToolResults, comparisonResults)
  const outputDir = path.resolve(options.output, 'analysis')

  computeProjectMetrics(toolResults, outputDir)

  SUBSETS.forEach(({ name, include }) => {
    const subsetDir = path.join(outputDir, name)
    const subsetToolResults = analyzedToolResults.filter(({ sameSides }) => include(sameSides))

    createBoxPlot(subsetToolResults.filter(({ comparable }) => comparable), subsetDir)
    computeToolMetrics(subsetToolResults, subsetDir)
    computeAgreementMetrics(completeResults.filter(({ sameSides }) => include(sameSides)), subsetDir)
  })
}
