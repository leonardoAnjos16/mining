import path from "path"
import { createCSV } from "../utils/csv.js"
import { CompleteResult, getLanguage } from "./index.js"

export class ComparisonMetric<T> {
  private defaultValue: () => T
  private onResult: (current: T, result: CompleteResult) => T

  private byTools: Record<string, Record<string, T>> = {}
  private byLanguageAndTools: Record<string, Record<string, Record<string, T>>> = {}
  private byProjectAndTools: Record<string, Record<string, Record<string, T>>> = {}

  name: string

  constructor(
    name: string,
    defaultValue: () => T,
    onResult: (current: T, result: CompleteResult) => T
  ) {
    this.name = name
    this.defaultValue = defaultValue
    this.onResult = onResult
  }

  update(result: CompleteResult) {
    const { project, filepath, tool, otherTool } = result
    if (!this.byTools[tool]) {
      this.byTools[tool] = {}
    }

    this.byTools[tool][otherTool] = this.onResult(this.byTools[tool][otherTool] ?? this.defaultValue(), result)

    const language = getLanguage(filepath)
    if (!this.byLanguageAndTools[language]) {
      this.byLanguageAndTools[language] = {}
    }

    if (!this.byLanguageAndTools[language][tool]) {
      this.byLanguageAndTools[language][tool] = {}
    }

    this.byLanguageAndTools[language][tool][otherTool] = this.onResult(this.byLanguageAndTools[language][tool][otherTool] ?? this.defaultValue(), result)

    if (!this.byProjectAndTools[project]) {
      this.byProjectAndTools[project] = {}
    }

    if (!this.byProjectAndTools[project][tool]) {
      this.byProjectAndTools[project][tool] = {}
    }

    this.byProjectAndTools[project][tool][otherTool] = this.onResult(this.byProjectAndTools[project][tool][otherTool] ?? this.defaultValue(), result)
  }

  getByTools(tool: string, otherTool: string) {
    return this.byTools[tool]?.[otherTool]
  }

  getByLanguageAndTools(language: string, tool: string, otherTool: string) {
    return this.byLanguageAndTools[language]?.[tool]?.[otherTool]
  }

  getByProjectAndTools(project: string, tool: string, otherTool: string) {
    return this.byProjectAndTools[project]?.[tool]?.[otherTool]
  }
}

export const computeAgreementMetrics = (results: CompleteResult[], outputDir: string) => {
  const metrics = [
    new ComparisonMetric(
      'agreements',
      () => 0,
      (current: number, result: CompleteResult) => current + (result.sameContent ? 1 : 0)
    ),
    new ComparisonMetric(
      'normalized-agreements',
      () => 0,
      (current: number, result: CompleteResult) => current + (result.sameNormalizedContent ? 1 : 0)
    ),
    new ComparisonMetric(
      'afp',
      () => 0,
      (current: number, result: CompleteResult) => {
        const isAFP = result.toolConflicts > 0 && result.otherToolConflicts === 0 && result.otherToolEqualGroundTruth
        return current + (isAFP ? 1 : 0)
      }
    ),
    new ComparisonMetric(
      'afn',
      () => 0,
      (current: number, result: CompleteResult) => {
        const isAFN = result.toolConflicts === 0 && result.otherToolConflicts > 0 && !result.toolEqualGroundTruth
        return current + (isAFN ? 1 : 0)
      }
    )
  ]
  
  const tools = new Set<string>()
  const languages = new Set<string>()
  const projects = new Set<string>()

  results.forEach(result => {
    tools.add(result.tool)
    languages.add(getLanguage(result.filepath))
    projects.add(result.project)
    metrics.forEach(metric => metric.update(result))
  })

  const sortedTools = [...tools].sort()
  const headers = ['tool', ...sortedTools]

  metrics.forEach(metric => {
    {
      const data = sortedTools.map<Record<string, string | number>>(tool => ({
        tool,
        ...sortedTools.reduce((res, otherTool) => ({
          ...res,
          [otherTool]: metric.getByTools(tool, otherTool)
        }), {})
      }))
  
      const filename = path.join(outputDir, `${metric.name}.csv`)
      createCSV(filename, headers, data)
    }

    ;[...languages].forEach(language => {
      const data = sortedTools.map<Record<string, string | number>>(tool => ({
        tool,
        ...sortedTools.reduce((res, otherTool) => ({
          ...res,
          [otherTool]: metric.getByLanguageAndTools(language, tool, otherTool)
        }), {})
      }))

      const filename = path.join(outputDir, 'languages', language, `${metric.name}.csv`)
      createCSV(filename, headers, data)
    })

    ;[...projects].forEach(project => {
      const data = sortedTools.map<Record<string, string | number>>(tool => ({
        tool,
        ...sortedTools.reduce((res, otherTool) => ({
          ...res,
          [otherTool]: metric.getByProjectAndTools(project, tool, otherTool)
        }), {})
      }))

      const filename = path.join(outputDir, 'projects', project, `${metric.name}.csv`)
      createCSV(filename, headers, data)
    })
  })
}
