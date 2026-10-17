import path from "path"
import { ToolResult } from "../experiment.js"
import { createCSV } from "../utils/csv.js"
import { getLanguage } from "./index.js"

export class ToolMetric<T, R> {
  private defaultValue: () => T
  private onResult: (current: T, result: ToolResult) => T
  private onFinish: (value: T) => R

  private byTool: Record<string, T> = {}
  private byLanguageAndTool: Record<string, Record<string, T>> = {}
  private byProjectAndTool: Record<string, Record<string, T>> = {}

  name: string

  constructor(
    name: string,
    defaultValue: () => T,
    onResult: (current: T, result: ToolResult) => T,
    onFinish: (value: T) => R
  ) {
    this.name = name
    this.defaultValue = defaultValue
    this.onResult = onResult
    this.onFinish = onFinish
  }

  update(result: ToolResult) {
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
    return this.onFinish(this.byTool[tool])
  }

  getByLanguageAndTool(language: string, tool: string) {
    return this.onFinish(this.byLanguageAndTool[language][tool])
  }

  getByProjectAndTool(project: string, tool: string) {
    return this.onFinish(this.byProjectAndTool[project][tool])
  }
}

export const computeToolMetrics = (toolResults: ToolResult[], outputDir: string) => {
  const metrics = [
    new ToolMetric(
      'conflicts',
      () => 0,
      (current: number, { conflicts }: ToolResult) => current + conflicts,
      (value: number) => value
    ),
    new ToolMetric(
      'scenarios with conflict',
      () => new Set<string>(),
      (current: Set<string>, { mergeCommit, conflicts }: ToolResult) => {
        const newValue = new Set(...current)
        if (conflicts > 0) newValue.add(mergeCommit)
  
        return newValue
      },
      (value: Set<string>) => value.size
    ),
    new ToolMetric(
      'files with conflict',
      () => 0,
      (current: number, { conflicts }: ToolResult) => current + (conflicts > 0 ? 1 : 0),
      (value: number) => value
    ),
    new ToolMetric(
      'failures',
      () => 0,
      (current: number, { fail }: ToolResult) => current + (fail ? 1 : 0),
      (value: number) => value
    )
  ]

  const tools = new Set<string>()
  const languages = new Set<string>()
  const projects = new Set<string>()

  toolResults.forEach((result: ToolResult) => {
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
