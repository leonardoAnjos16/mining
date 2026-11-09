import path from "path"
import { parseCSV } from "../utils/csv.js"
import { fileExists } from "../utils/file.js"
import { getLanguage } from "../utils/language.js"
import { ComparisonResult, ToolResult } from "../experiment.js"

export type ToolOutcome = {
  conflicts: number
  fail: boolean
  timeout: boolean
  timeMeasurements: number[]
  equalsMerge: boolean
}

export type OutputComparison = {
  sameContent: boolean
  sameNormalizedContent: boolean
}

export type Scenario = {
  project: string
  mergeCommit: string
  filepath: string
  language: string
  sameSides: boolean
  comparable: boolean
  tools: Record<string, ToolOutcome>
  comparisons: Record<string, Record<string, OutputComparison>>
}

const parseBoolean = (value: string) => value === 'true'

const getResultsFile = (resultsPath: string, filename: string) => {
  const filepath = path.resolve(resultsPath, filename)
  if (!fileExists(filepath)) {
    throw new Error(`Missing ${filename} in ${resultsPath}`)
  }

  return filepath
}

export const loadScenarios = (resultsPath: string): Scenario[] => {
  const toolResults = parseCSV<ToolResult>(getResultsFile(resultsPath, 'tools.csv'), {
    conflicts: Number,
    sameSides: parseBoolean,
    fail: parseBoolean,
    timeout: parseBoolean,
    timeMeasurements: (value: string) => JSON.parse(value)
  })

  const comparisonResults = parseCSV<ComparisonResult>(getResultsFile(resultsPath, 'comparisons.csv'), {
    sameContent: parseBoolean,
    sameNormalizedContent: parseBoolean
  })

  const scenarios = new Map<string, Scenario>()
  const getKey = ({ project, mergeCommit, filepath }: { project: string, mergeCommit: string, filepath: string }) =>
    `${project}##${mergeCommit}##${filepath}`

  toolResults.forEach(({ project, mergeCommit, filepath, sameSides, tool, conflicts, fail, timeout, timeMeasurements }) => {
    const key = getKey({ project, mergeCommit, filepath })
    if (!scenarios.has(key)) {
      scenarios.set(key, {
        project,
        mergeCommit,
        filepath,
        language: getLanguage(filepath),
        sameSides,
        comparable: true,
        tools: {},
        comparisons: {}
      })
    }

    const scenario = scenarios.get(key)!
    scenario.tools[tool] = { conflicts, fail, timeout, timeMeasurements, equalsMerge: false }

    if (fail) scenario.comparable = false
  })

  comparisonResults.forEach(({ tool, otherTool, sameContent, sameNormalizedContent, ...context }) => {
    const scenario = scenarios.get(getKey(context))
    if (!scenario?.tools[tool]) {
      throw new Error(`Missing tool results for ${getKey(context)}`)
    }

    if (otherTool === 'ground-truth') {
      scenario.tools[tool].equalsMerge = sameNormalizedContent
    } else {
      scenario.comparisons[tool] ??= {}
      scenario.comparisons[tool][otherTool] = { sameContent, sameNormalizedContent }
    }
  })

  return [...scenarios.values()]
}
