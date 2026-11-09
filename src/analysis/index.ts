import path from "path"
import { createBoxPlots } from "./time.js"
import { loadScenarios, Scenario } from "./load.js"
import { groupScenarios } from "./group.js"
import { writeCounts, writePairMetrics, writeToolMetrics } from "./write.js"
import { Report } from "./report.js"

type AnalysisOptions = {
  output: string
  alias?: string
}

const SUBSETS = [
  { name: 'all', include: (_: Scenario) => true },
  { name: 'different-sides', include: ({ sameSides }: Scenario) => !sameSides },
  { name: 'same-sides', include: ({ sameSides }: Scenario) => sameSides }
]

export const computeMetrics = (resultsPath: string, options: AnalysisOptions) => {
  const scenarios = loadScenarios(resultsPath)
  const tools = [...new Set(scenarios.flatMap(({ tools }) => Object.keys(tools)))].sort()
  const report = new Report(path.resolve(options.output, 'analysis', options.alias ?? Date.now().toString()))

  writeCounts(report, scenarios)

  SUBSETS.forEach(({ name, include }) => {
    const subset = scenarios.filter(include)
    const comparable = subset.filter(({ comparable }) => comparable)

    groupScenarios(subset, name).forEach(({ dir, scenarios }) => writeToolMetrics(report, dir, scenarios, tools))
    groupScenarios(comparable, name).forEach(({ dir, scenarios }) => {
      writePairMetrics(report, dir, scenarios, tools)
      createBoxPlots(scenarios, report.resolve(dir))
    })
  })

  report.writePage()
}
