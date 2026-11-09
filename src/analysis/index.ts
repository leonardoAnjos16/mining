import path from "path"
import { createBoxPlot } from "./time.js"
import { loadScenarios, Scenario } from "./load.js"
import { groupScenarios } from "./group.js"
import { writeCounts, writePairMetrics, writeToolMetrics } from "./write.js"

type AnalysisOptions = {
  output: string
}

const SUBSETS = [
  { name: 'all', include: (_: Scenario) => true },
  { name: 'different-sides', include: ({ sameSides }: Scenario) => !sameSides },
  { name: 'same-sides', include: ({ sameSides }: Scenario) => sameSides }
]

export const computeMetrics = (resultsPath: string, options: AnalysisOptions) => {
  const scenarios = loadScenarios(resultsPath)
  const tools = [...new Set(scenarios.flatMap(({ tools }) => Object.keys(tools)))].sort()
  const outputDir = path.resolve(options.output, 'analysis')

  writeCounts(outputDir, scenarios)

  SUBSETS.forEach(({ name, include }) => {
    const subsetDir = path.join(outputDir, name)
    const subset = scenarios.filter(include)
    const comparable = subset.filter(({ comparable }) => comparable)

    createBoxPlot(comparable, subsetDir)
    groupScenarios(subset, subsetDir).forEach(({ dir, scenarios }) => writeToolMetrics(dir, scenarios, tools))
    groupScenarios(comparable, subsetDir).forEach(({ dir, scenarios }) => writePairMetrics(dir, scenarios, tools))
  })
}
