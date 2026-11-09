import path from "path"
import { Report } from "./report.js"
import { Scenario } from "./load.js"
import { groupBy } from "./group.js"
import { getPairs, getRuns, PAIR_METRICS, TOOL_TABLES } from "./metrics.js"

const countScenarios = (scenarios: Scenario[]) => ({
  scenarios: new Set(scenarios.map(({ project, mergeCommit }) => `${project}##${mergeCommit}`)).size,
  files: scenarios.length
})

export const writeCounts = (report: Report, scenarios: Scenario[]) => {
  const total = countScenarios(scenarios)

  const byProject = Array.from(groupBy(scenarios, ({ project }) => project), ([project, projectScenarios]) => ({
    project,
    language: projectScenarios[0].language,
    ...countScenarios(projectScenarios)
  })).sort((a, b) => a.language.localeCompare(b.language) || a.project.localeCompare(b.project))

  report.writeTable(
    'project-counts.csv',
    ['project', 'language', 'scenarios', 'files'],
    [...byProject, { project: 'total', language: '', ...total }]
  )

  const byLanguage = Array.from(groupBy(scenarios, ({ language }) => language), ([language, languageScenarios]) => ({
    language,
    ...countScenarios(languageScenarios)
  })).sort((a, b) => a.language.localeCompare(b.language))

  report.writeTable(
    'language-counts.csv',
    ['language', 'scenarios', 'files'],
    [...byLanguage, { language: 'total', ...total }]
  )
}

export const writeToolMetrics = (report: Report, dir: string, scenarios: Scenario[], tools: string[]) => {
  const runs = Object.fromEntries(tools.map(tool => [tool, getRuns(scenarios, tool)]))

  Object.entries(TOOL_TABLES).forEach(([file, metrics]) => {
    const data = tools.map<Record<string, string | number>>(tool => ({
      tool,
      ...Object.fromEntries(metrics.map(({ name, value }) => [name, value(runs[tool])]))
    }))

    report.writeTable(path.join(dir, file), ['tool', ...metrics.map(({ name }) => name)], data)
  })
}

export const writePairMetrics = (report: Report, dir: string, scenarios: Scenario[], tools: string[]) => {
  PAIR_METRICS.forEach(({ name, value }) => {
    const data = tools.map<Record<string, string | number>>(tool => ({
      tool,
      ...Object.fromEntries(tools.map(otherTool => [
        otherTool,
        tool === otherTool ? '' : value(getPairs(scenarios, tool, otherTool))
      ]))
    }))

    report.writeTable(path.join(dir, `${name}.csv`), ['tool', ...tools], data)
  })
}
