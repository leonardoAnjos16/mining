import path from "path"
import { Scenario } from "./load.js"

export type Group = {
  dir: string
  scenarios: Scenario[]
}

const groupBy = (scenarios: Scenario[], getDir: (scenario: Scenario) => string): Group[] => {
  const groups = new Map<string, Scenario[]>()
  scenarios.forEach(scenario => {
    const dir = getDir(scenario)
    if (!groups.has(dir)) groups.set(dir, [])
    groups.get(dir)!.push(scenario)
  })

  return Array.from(groups, ([dir, scenarios]) => ({ dir, scenarios }))
}

export const groupScenarios = (scenarios: Scenario[], dir: string): Group[] => [
  { dir, scenarios },
  ...groupBy(scenarios, ({ language }) => path.join(dir, 'languages', language)),
  ...groupBy(scenarios, ({ project }) => path.join(dir, 'projects', project))
]
