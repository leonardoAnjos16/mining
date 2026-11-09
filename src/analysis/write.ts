import path from "path"
import { createCSV } from "../utils/csv.js"
import { Scenario } from "./load.js"
import { groupBy } from "./group.js"
import { getPairs, getRuns, PAIR_METRICS, TOOL_METRICS } from "./metrics.js"

const countScenarios = (scenarios: Scenario[]) => ({
  scenarios: new Set(scenarios.map(({ project, mergeCommit }) => `${project}##${mergeCommit}`)).size,
  files: scenarios.length
})

export const writeCounts = (dir: string, scenarios: Scenario[]) => {
  const total = countScenarios(scenarios)

  const byProject = Array.from(groupBy(scenarios, ({ project }) => project), ([project, projectScenarios]) => ({
    project,
    language: projectScenarios[0].language,
    ...countScenarios(projectScenarios)
  })).sort((a, b) => a.language.localeCompare(b.language) || a.project.localeCompare(b.project))

  createCSV(
    path.join(dir, 'project-counts.csv'),
    ['project', 'language', 'scenarios', 'files'],
    [...byProject, { project: 'total', language: '', ...total }]
  )

  const byLanguage = Array.from(groupBy(scenarios, ({ language }) => language), ([language, languageScenarios]) => ({
    language,
    ...countScenarios(languageScenarios)
  })).sort((a, b) => a.language.localeCompare(b.language))

  createCSV(
    path.join(dir, 'language-counts.csv'),
    ['language', 'scenarios', 'files'],
    [...byLanguage, { language: 'total', ...total }]
  )
}

export const writeToolMetrics = (dir: string, scenarios: Scenario[], tools: string[]) => {
  const data = tools.map<Record<string, string | number>>(tool => {
    const runs = getRuns(scenarios, tool)
    return { tool, ...Object.fromEntries(TOOL_METRICS.map(({ name, value }) => [name, value(runs)])) }
  })

  createCSV(path.join(dir, 'tools.csv'), ['tool', ...TOOL_METRICS.map(({ name }) => name)], data)
}

export const writePairMetrics = (dir: string, scenarios: Scenario[], tools: string[]) => {
  PAIR_METRICS.forEach(({ name, value }) => {
    const data = tools.map<Record<string, string | number>>(tool => ({
      tool,
      ...Object.fromEntries(tools.map(otherTool => [
        otherTool,
        tool === otherTool ? '' : value(getPairs(scenarios, tool, otherTool))
      ]))
    }))

    createCSV(path.join(dir, `${name}.csv`), ['tool', ...tools], data)
  })
}
