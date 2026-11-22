import type { CaseGroup, CasesData } from '../../../analysis/cases/types'
import { useApp } from '../context'
import { getVisibleGroups } from '../helpers'
import type { State } from '../state'
import type { Origin } from './CaseHeader'
import { CaseView } from './CaseView'
import { GroupSelectors } from './GroupSelectors'
import { GroupView } from './GroupView'
import { Overview } from './Overview'

const getOverviewTool = (groups: CaseGroup[], group: string) => {
  const [scope, tool] = group.split('/')
  return scope === 'all' && groups.some(candidate => candidate.tool === tool) ? tool : ''
}

export const getLabelMetric = (state: State, cases: CasesData | null, hidden: Set<string>) => {
  if (!cases || state.case) return ''
  return getVisibleGroups(cases, hidden).find(({ id }) => id === state.group)?.metric ?? ''
}

export const CasesTab = () => {
  const { state, cases, hidden } = useApp()
  if (!cases) return <p className="description">No cases yet: run "analysis cases" with this alias.</p>

  const groups = getVisibleGroups(cases, hidden)
  if (groups.length === 0) return <p>No groups: every tool is hidden.</p>
  const selectedGroup = groups.find(({ id }) => id === state.group)

  const labelErrors = cases.labelErrors.length > 0 && (
    <div className="error-box">The label list is invalid:<ul>{cases.labelErrors.map(error => <li key={error}>{error}</li>)}</ul></div>
  )

  const info = state.case ? cases.cases[state.case] : undefined
  if (info) {
    const [labelMetric, labelId] = state.label.includes('/') ? state.label.split('/') : ['', '']
    const inCase = (candidate: CaseGroup) => info.groups.includes(candidate.id)
    const caseGroup = selectedGroup
      ?? groups.find(candidate => inCase(candidate) && candidate.metric === labelMetric && candidate.tool === state.outputLeft)
      ?? groups.find(candidate => inCase(candidate) && candidate.tool === state.outputLeft)
      ?? groups.find(inCase)
    const origin: Origin = selectedGroup
      ? { group: selectedGroup }
      : { metric: labelMetric || caseGroup?.metric || '', tool: state.outputLeft || caseGroup?.tool || '', label: labelId }
    return <>{labelErrors}<CaseView info={info} group={caseGroup} origin={origin} /></>
  }

  const overviewTool = getOverviewTool(groups, state.group)
  return <>
    {labelErrors}
    <GroupSelectors groups={groups} selected={selectedGroup} overviewTool={overviewTool} />
    {selectedGroup ? <GroupView group={selectedGroup} /> : <Overview groups={groups} overviewTool={overviewTool} />}
  </>
}
