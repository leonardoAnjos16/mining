import path from "path"
import { Scenario } from "./load.js"

export type Group = {
  dir: string
  scenarios: Scenario[]
}

export const groupBy = <T>(items: T[], getKey: (item: T) => string) => {
  const groups = new Map<string, T[]>()
  items.forEach(item => {
    const key = getKey(item)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(item)
  })

  return groups
}

const toGroups = (groups: Map<string, Scenario[]>): Group[] => Array.from(groups, ([dir, scenarios]) => ({ dir, scenarios }))

export const groupScenarios = (scenarios: Scenario[], dir: string): Group[] => [
  { dir, scenarios },
  ...toGroups(groupBy(scenarios, ({ language }) => path.join(dir, 'languages', language))),
  ...toGroups(groupBy(scenarios, ({ project }) => path.join(dir, 'projects', project)))
]
