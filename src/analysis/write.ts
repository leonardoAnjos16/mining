import path from "path"
import { createCSV } from "../utils/csv.js"
import { Scenario } from "./load.js"
import { getPairs, getRuns, PAIR_METRICS, TOOL_METRICS } from "./metrics.js"

export const writeCounts = (dir: string, scenarios: Scenario[]) => {
  const projects = [...new Set(scenarios.map(({ project }) => project))].sort()
  const data = projects.map(project => {
    const projectScenarios = scenarios.filter(scenario => scenario.project === project)
    return {
      project,
      scenarios: new Set(projectScenarios.map(({ mergeCommit }) => mergeCommit)).size,
      files: projectScenarios.length
    }
  })

  createCSV(path.join(dir, 'counts.csv'), ['project', 'scenarios', 'files'], data)
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
