import type { CaseGroup, CasesData, CaseSummary } from '../../analysis/cases/types'
import { CASE_METRICS } from './constants'
import type { State } from './state'

export const getHidden = (hidden: string) => new Set(hidden.split(',').filter(Boolean))

export const getDir = ({ subset, scope }: State) => scope ? `${subset}/${scope}` : subset

export const getVisibleGroups = (cases: CasesData, hidden: Set<string>) =>
  cases.groups.filter(({ tool, otherTool }) => !hidden.has(tool) && !(otherTool && hidden.has(otherTool)))

export const pairTitle = ({ tool, otherTool }: CaseGroup) => otherTool ? `${tool} vs ${otherTool}` : tool

export const groupTitle = (group: CaseGroup) => `${CASE_METRICS[group.metric].name} · ${pairTitle(group)}`

export const getOutcome = (info: CaseSummary | undefined, groupId: string) => info?.annotation?.groups?.[groupId]

export const withPercentage = (count: number, total: number) => count === 0 ? '' : `${count} (${Math.round(count / total * 100)}%)`
