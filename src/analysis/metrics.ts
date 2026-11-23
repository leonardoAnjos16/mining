import { groupBy } from "./group.js"
import { OutputComparison, Scenario, ToolOutcome } from "./load.js"

export type Run = ToolOutcome & { scenario: Scenario }

export type Pair = {
  tool: ToolOutcome
  otherTool: ToolOutcome
  comparison: OutputComparison
}

export type Metric<T> = {
  name: string
  value: (items: T[]) => number | string
}

type Predicate<T> = (item: T) => boolean

export const getRuns = (scenarios: Scenario[], tool: string): Run[] =>
  scenarios.map(scenario => ({ ...scenario.tools[tool], scenario }))

export const getPairs = (scenarios: Scenario[], tool: string, otherTool: string): Pair[] =>
  scenarios.map(scenario => ({
    tool: scenario.tools[tool],
    otherTool: scenario.tools[otherTool],
    comparison: scenario.comparisons[tool][otherTool]
  }))

const toPercentage = (count: number, total: number) => total > 0 ? Number(((count / total) * 100).toFixed(1)) : ''

const always = () => true
const hasConflict = ({ conflicts }: ToolOutcome) => conflicts > 0
const isComparable: Predicate<Run> = ({ scenario }) => scenario.comparable
const isConflictDisagreement: Predicate<Pair> = ({ tool, otherTool }) => hasConflict(tool) !== hasConflict(otherTool)

const count = <T>(name: string, match: Predicate<T>, where: Predicate<T> = always): Metric<T> => ({
  name,
  value: items => items.filter(where).filter(match).length
})

const countWithPercentage = <T>(name: string, separator: string, match: Predicate<T>, where: Predicate<T> = always): Metric<T>[] => [
  count(name, match, where),
  {
    name: `${name}${separator}`,
    value: items => {
      const included = items.filter(where)
      return toPercentage(included.filter(match).length, included.length)
    }
  }
]

const countRuns = (name: string, match: Predicate<Run>, where = isComparable) => count(name, match, where)
const countRunsWithPercentage = (name: string, match: Predicate<Run>, where = isComparable) => countWithPercentage(name, ' %', match, where)

const countScenarios = (runs: Run[]) =>
  new Set(runs.map(({ scenario }) => `${scenario.project}##${scenario.mergeCommit}`)).size

const TOOL_METRICS: Metric<Run>[] = [
  { name: 'scenarios', value: countScenarios },
  countRuns('files', always, always),
  ...countRunsWithPercentage('failures', ({ fail }) => fail, always),
  countRuns('timeouts', ({ timeout }) => timeout, always),
  {
    name: 'conflicts',
    value: runs => runs.filter(isComparable).reduce((total, { conflicts }) => total + conflicts, 0)
  },
  {
    name: 'scenarios with conflict',
    value: runs => countScenarios(runs.filter(isComparable).filter(hasConflict))
  },
  {
    name: 'scenarios with conflict %',
    value: runs => {
      const comparable = runs.filter(isComparable)
      return toPercentage(countScenarios(comparable.filter(hasConflict)), countScenarios(comparable))
    }
  },
  ...countRunsWithPercentage('files with conflict', hasConflict)
]

const CORRECTNESS_METRICS: Metric<Run>[] = [
  countRuns('files', always),
  ...countRunsWithPercentage('with conflict', hasConflict),
  ...countRunsWithPercentage('clean and equal to merge', run => !hasConflict(run) && run.equalsMerge),
  ...countRunsWithPercentage('clean and different from merge', run => !hasConflict(run) && !run.equalsMerge)
]

const groupComparableByScenario = (runs: Run[]) =>
  Array.from(groupBy(runs.filter(isComparable), ({ scenario }) => `${scenario.project}##${scenario.mergeCommit}`).values())

const countScenariosWithPercentage = (name: string, match: (scenarioRuns: Run[]) => boolean): Metric<Run>[] => [
  { name, value: runs => groupComparableByScenario(runs).filter(match).length },
  {
    name: `${name} %`,
    value: runs => {
      const scenarios = groupComparableByScenario(runs)
      return toPercentage(scenarios.filter(match).length, scenarios.length)
    }
  }
]

const SCENARIO_CORRECTNESS_METRICS: Metric<Run>[] = [
  { name: 'scenarios', value: runs => groupComparableByScenario(runs).length },
  ...countScenariosWithPercentage('with conflict', scenarioRuns => scenarioRuns.some(hasConflict)),
  ...countScenariosWithPercentage('clean and equal to merge', scenarioRuns => scenarioRuns.every(run => !hasConflict(run) && run.equalsMerge)),
  ...countScenariosWithPercentage('clean and different from merge', scenarioRuns => !scenarioRuns.some(hasConflict) && scenarioRuns.some(run => !run.equalsMerge))
]

export const TOOL_TABLES: Record<string, Metric<Run>[]> = {
  'tools.csv': TOOL_METRICS,
  'correctness.csv': CORRECTNESS_METRICS,
  'scenario-correctness.csv': SCENARIO_CORRECTNESS_METRICS
}

const countPairsWithPercentage = (name: string, match: Predicate<Pair>, base: Predicate<Pair>) =>
  countWithPercentage(name, '-percentage', match, base)

export const PAIR_METRICS: Metric<Pair>[] = [
  count('compared', always),
  count('conflict-disagreements', isConflictDisagreement),
  ...countPairsWithPercentage('agreements', ({ comparison }) => comparison.sameContent, always),
  ...countPairsWithPercentage('normalized-agreements', ({ comparison }) => comparison.sameNormalizedContent, always),
  ...countPairsWithPercentage(
    'afp',
    ({ tool, otherTool }) => hasConflict(tool) && !hasConflict(otherTool) && otherTool.equalsMerge,
    isConflictDisagreement
  ),
  ...countPairsWithPercentage(
    'afn',
    ({ tool, otherTool }) => !hasConflict(tool) && hasConflict(otherTool) && !tool.equalsMerge,
    isConflictDisagreement
  )
]
