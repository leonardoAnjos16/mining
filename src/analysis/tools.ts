import path from "path"
import { createCSV } from "../utils/csv.js"
import { AnalyzedToolResult, getLanguage } from "./index.js"

export class ToolMetric<T, R> {
  private defaultValue: () => T
  private onResult: (current: T, result: AnalyzedToolResult) => T
  private onFinish: (value: T) => R

  private byTool: Record<string, T> = {}
  private byLanguageAndTool: Record<string, Record<string, T>> = {}
  private byProjectAndTool: Record<string, Record<string, T>> = {}

  name: string

  constructor(
    name: string,
    defaultValue: () => T,
    onResult: (current: T, result: AnalyzedToolResult) => T,
    onFinish: (value: T) => R
  ) {
    this.name = name
    this.defaultValue = defaultValue
    this.onResult = onResult
    this.onFinish = onFinish
  }

  update(result: AnalyzedToolResult) {
    const { project, filepath, tool } = result
    this.byTool[tool] = this.onResult(this.byTool[tool] ?? this.defaultValue(), result)

    const language = getLanguage(filepath)
    if (!this.byLanguageAndTool[language]) {
      this.byLanguageAndTool[language] = {}
    }

    this.byLanguageAndTool[language][tool] = this.onResult(this.byLanguageAndTool[language][tool] ?? this.defaultValue(), result)

    if (!this.byProjectAndTool[project]) {
      this.byProjectAndTool[project] = {}
    }

    this.byProjectAndTool[project][tool] = this.onResult(this.byProjectAndTool[project][tool] ?? this.defaultValue(), result)
  }

  getByTool(tool: string) {
    return this.onFinish(this.byTool[tool] ?? this.defaultValue())
  }

  getByLanguageAndTool(language: string, tool: string) {
    return this.onFinish(this.byLanguageAndTool[language]?.[tool] ?? this.defaultValue())
  }

  getByProjectAndTool(project: string, tool: string) {
    return this.onFinish(this.byProjectAndTool[project]?.[tool] ?? this.defaultValue())
  }
}

type Predicate = (result: AnalyzedToolResult) => boolean

const isComparable: Predicate = ({ comparable }) => comparable
const isClean: Predicate = ({ conflicts }) => conflicts === 0

const formatPercentage = (count: number, total: number) => total > 0 ? Number(((count / total) * 100).toFixed(1)) : ''

const count = (name: string, predicate: Predicate, include: Predicate = isComparable) =>
  new ToolMetric<number, number>(
    name,
    () => 0,
    (current, result) => current + (include(result) && predicate(result) ? 1 : 0),
    value => value
  )

const percentage = (name: string, predicate: Predicate, include: Predicate = isComparable) =>
  new ToolMetric<{ count: number, total: number }, number | string>(
    `${name} %`,
    () => ({ count: 0, total: 0 }),
    (current, result) => include(result)
      ? { count: current.count + (predicate(result) ? 1 : 0), total: current.total + 1 }
      : current,
    value => formatPercentage(value.count, value.total)
  )

const all: Predicate = () => true

export const computeToolMetrics = (toolResults: AnalyzedToolResult[], outputDir: string) => {
  const metrics = [
    count('files', all, all),
    count('failures', ({ fail }) => fail, all),
    percentage('failures', ({ fail }) => fail, all),
    count('timeouts', ({ timeout }) => timeout, all),
    count('compared files', all),
    new ToolMetric(
      'conflicts',
      () => 0,
      (current: number, result: AnalyzedToolResult) => current + (isComparable(result) ? result.conflicts : 0),
      (value: number) => value
    ),
    new ToolMetric(
      'scenarios with conflict',
      () => new Set<string>(),
      (current: Set<string>, result: AnalyzedToolResult) => {
        if (isComparable(result) && !isClean(result)) current.add(`${result.project}##${result.mergeCommit}`)
        return current
      },
      (value: Set<string>) => value.size
    ),
    count('files with conflict', result => !isClean(result)),
    percentage('files with conflict', result => !isClean(result)),
    count('clean and equal to merge', result => isClean(result) && result.equalGroundTruth),
    percentage('clean and equal to merge', result => isClean(result) && result.equalGroundTruth),
    count('clean and different from merge', result => isClean(result) && !result.equalGroundTruth),
    percentage('clean and different from merge', result => isClean(result) && !result.equalGroundTruth)
  ]

  const tools = new Set<string>()
  const languages = new Set<string>()
  const projects = new Set<string>()

  toolResults.forEach(result => {
    tools.add(result.tool)
    languages.add(getLanguage(result.filepath))
    projects.add(result.project)
    metrics.forEach(metric => metric.update(result))
  })

  const sortedTools = [...tools].sort()
  const headers = ['tool', ...metrics.map(({ name }) => name)]

  {
    const data = sortedTools.map<Record<string, string | number>>(tool => ({
      tool,
      ...metrics.reduce((res, metric) => ({
        ...res,
        [metric.name]: metric.getByTool(tool)
      }), {})
    }))

    const filename = path.join(outputDir, 'tools.csv')
    createCSV(filename, headers, data)
  }

  ;[...languages].forEach(language => {
    const data = sortedTools.map<Record<string, string | number>>(tool => ({
      tool,
      ...metrics.reduce((res, metric) => ({
        ...res,
        [metric.name]: metric.getByLanguageAndTool(language, tool)
      }), {})
    }))

    const filename = path.join(outputDir, 'languages', language, 'tools.csv')
    createCSV(filename, headers, data)
  })

  ;[...projects].forEach(project => {
    const data = sortedTools.map<Record<string, string | number>>(tool => ({
      tool,
      ...metrics.reduce((res, metric) => ({
        ...res,
        [metric.name]: metric.getByProjectAndTool(project, tool)
      }), {})
    }))

    const filename = path.join(outputDir, 'projects', project, 'tools.csv')
    createCSV(filename, headers, data)
  })
}
