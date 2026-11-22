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

const interleave = <T>(lists: T[][]) => {
  const longest = Math.max(0, ...lists.map(list => list.length))
  return Array.from({ length: longest }, (_, index) => lists.flatMap(list => list[index] ?? [])).flat()
}

const splitBy = (scenarios: Scenario[], getKey: (scenario: Scenario) => string) =>
  Array.from(groupBy(scenarios, getKey).values())

const balanceLanguagesAndProjects = (scenarios: Scenario[]) => interleave(
  splitBy(scenarios, ({ language }) => language).map(languageScenarios => interleave(splitBy(languageScenarios, ({ project }) => project)))
)

export const selectCases = (scenarios: Scenario[], tools: string[], perGroup: number, seed: number) => {
  const comparable = scenarios.filter(({ comparable }) => comparable)

  return getCandidates(comparable, tools).map(({ group, scenarios }) => {
    const sorted = [...scenarios].sort((a, b) => getScenarioKey(a).localeCompare(getScenarioKey(b)))
    const selected = balanceLanguagesAndProjects(shuffle(sorted, seed)).slice(0, perGroup)

    return {
      group: { ...group, total: scenarios.length, cases: selected.map(getCaseId) } as CaseGroup,
      selected
    }
  })
}
