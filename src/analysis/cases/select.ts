import { createHash } from 'crypto'
import { getScenarioKey, Scenario, ToolOutcome } from '../load.js'
import { groupBy } from '../group.js'
import { shuffle } from '../../utils/random.js'
import { CaseGroup, ToolState } from './types.js'

export const getCaseId = (scenario: Scenario) => createHash('sha1').update(getScenarioKey(scenario)).digest('hex').slice(0, 12)

export const getRecordedState = ({ fail, conflicts, equalsMerge }: ToolOutcome): ToolState => {
  if (fail) return 'failed'
  if (conflicts > 0) return 'conflict'
  return equalsMerge ? 'clean-equal' : 'clean-different'
}

const isClean = (outcome: ToolOutcome) => outcome.conflicts === 0

const getCandidates = (scenarios: Scenario[], tools: string[]) => {
  const groups: { group: Omit<CaseGroup, 'total' | 'cases'>, scenarios: Scenario[] }[] = []

  tools.forEach(tool => {
    tools.filter(otherTool => otherTool !== tool).forEach(otherTool => {
      groups.push({
        group: { id: `afp/${tool}/${otherTool}`, metric: 'afp', tool, otherTool },
        scenarios: scenarios.filter(({ tools }) => !isClean(tools[tool]) && isClean(tools[otherTool]) && tools[otherTool].equalsMerge)
      })
      groups.push({
        group: { id: `afn/${tool}/${otherTool}`, metric: 'afn', tool, otherTool },
        scenarios: scenarios.filter(({ tools }) => isClean(tools[tool]) && !tools[tool].equalsMerge && !isClean(tools[otherTool]))
      })
    })

    groups.push({
      group: { id: `clean-different/${tool}`, metric: 'clean-different', tool },
      scenarios: scenarios.filter(({ tools }) => isClean(tools[tool]) && !tools[tool].equalsMerge)
    })
  })

  return groups
}

const interleaveProjects = (scenarios: Scenario[]) => {
  const byProject = Array.from(groupBy(scenarios, ({ project }) => project).values())
  const longest = Math.max(0, ...byProject.map(projectScenarios => projectScenarios.length))
  return Array.from({ length: longest }, (_, index) => byProject.flatMap(projectScenarios => projectScenarios[index] ?? []))
    .flat()
}

export const selectCases = (scenarios: Scenario[], tools: string[], perGroup: number, seed: number, isAnnotated: (id: string) => boolean) => {
  const comparable = scenarios.filter(({ comparable }) => comparable)

  return getCandidates(comparable, tools).map(({ group, scenarios }) => {
    const sorted = [...scenarios].sort((a, b) => getScenarioKey(a).localeCompare(getScenarioKey(b)))
    const ordered = interleaveProjects(shuffle(sorted, seed))
    const annotatedFirst = [
      ...ordered.filter(scenario => isAnnotated(getCaseId(scenario))),
      ...ordered.filter(scenario => !isAnnotated(getCaseId(scenario)))
    ]

    return {
      group: { ...group, total: scenarios.length, cases: annotatedFirst.slice(0, perGroup).map(getCaseId) } as CaseGroup,
      selected: annotatedFirst.slice(0, perGroup)
    }
  })
}
