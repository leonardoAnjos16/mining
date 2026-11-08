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
  
  const compared = new ComparisonMetric('compared', () => 0, (current: number) => current + 1)
  const conflictDisagreements = new ComparisonMetric(
    'conflict-disagreements',
    () => 0,
    (current: number, result: CompleteResult) => current + ((result.toolConflicts > 0) !== (result.otherToolConflicts > 0) ? 1 : 0)
  )

  const bases = [compared, conflictDisagreements]
  const percentageBases: Record<string, ComparisonMetric<number>> = { afp: conflictDisagreements, afn: conflictDisagreements }

  const tools = new Set<string>()
  const languages = new Set<string>()
  const projects = new Set<string>()

  results.forEach(result => {
    tools.add(result.tool)
    languages.add(getLanguage(result.filepath))
    projects.add(result.project)
    bases.forEach(base => base.update(result))
    metrics.forEach(metric => metric.update(result))
  })

  const sortedTools = [...tools].sort()
  const headers = ['tool', ...sortedTools]

  const writeMatrix = (filename: string, getValue: (tool: string, otherTool: string) => number | string | undefined) => {
    const data = sortedTools.map<Record<string, string | number>>(tool => ({
      tool,
      ...sortedTools.reduce((res, otherTool) => ({
        ...res,
        [otherTool]: getValue(tool, otherTool) ?? ''
      }), {})
    }))

    createCSV(filename, headers, data)
  }

  const toPercentage = (value: number | undefined, total: number | undefined) =>
    value !== undefined && total ? Number(((value / total) * 100).toFixed(1)) : undefined

  const groups = [
    { dir: outputDir, get: <T>(metric: ComparisonMetric<T>, tool: string, otherTool: string) => metric.getByTools(tool, otherTool) },
    ...Array.from(languages, language => ({
      dir: path.join(outputDir, 'languages', language),
      get: <T>(metric: ComparisonMetric<T>, tool: string, otherTool: string) => metric.getByLanguageAndTools(language, tool, otherTool)
    })),
    ...Array.from(projects, project => ({
      dir: path.join(outputDir, 'projects', project),
      get: <T>(metric: ComparisonMetric<T>, tool: string, otherTool: string) => metric.getByProjectAndTools(project, tool, otherTool)
    }))
  ]

  groups.forEach(({ dir, get }) => {
    bases.forEach(base => writeMatrix(path.join(dir, `${base.name}.csv`), (tool, otherTool) => get(base, tool, otherTool)))

    metrics.forEach(metric => {
      writeMatrix(path.join(dir, `${metric.name}.csv`), (tool, otherTool) => get(metric, tool, otherTool))
      writeMatrix(
        path.join(dir, `${metric.name}-percentage.csv`),
        (tool, otherTool) => toPercentage(get(metric, tool, otherTool), get(percentageBases[metric.name] ?? compared, tool, otherTool))
      )
    })
  })
}
