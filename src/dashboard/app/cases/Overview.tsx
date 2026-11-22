import type { CaseGroup, CaseSummary, Label, Metric } from '../../../analysis/cases/types'
import { LabelHelp, LabelsCell, useLabelName } from '../components/LabelHelp'
import { CASE_METRICS, OVERVIEW_DESCRIPTIONS } from '../constants'
import { useApp, useCases } from '../context'
import { getOutcome, pairTitle, withPercentage } from '../helpers'

type Entry = { info: CaseSummary, group: CaseGroup, labels: string[], note: string }

const getEntries = (groups: CaseGroup[], cases: Record<string, CaseSummary>): Entry[] => groups.flatMap(group => group.cases.flatMap(id => {
  const outcome = getOutcome(cases[id], group.id)
  return outcome ? [{ info: cases[id], group, labels: outcome.labels, note: outcome.note }] : []
}))

const MetricTable = ({ metric, groups, overviewTool }: { metric: Metric, groups: CaseGroup[], overviewTool: string }) => {
  const { state, update } = useApp()
  const cases = useCases()
  const labelName = useLabelName()
  const tools = Array.from(new Set(groups.map(({ tool }) => tool))).sort()
  const [selectedMetric, selectedLabel] = state.label.includes('/') ? state.label.split('/') : ['', '']

  const metricGroups = groups.filter(group => group.metric === metric)
  const columns = (!overviewTool
    ? tools.map(tool => ({ header: tool, groups: metricGroups.filter(group => group.tool === tool) }))
    : metric === 'clean-different'
      ? [{ header: overviewTool, groups: metricGroups.filter(group => group.tool === overviewTool) }]
      : metricGroups.filter(group => group.tool === overviewTool).map(group => ({ header: `vs ${group.otherTool}`, groups: [group] }))
  ).map(column => ({ ...column, entries: getEntries(column.groups, cases.cases) }))

  const entries = getEntries(columns.flatMap(column => column.groups), cases.cases)
  const countIn = (list: Entry[], label: Label) => list.filter(entry => entry.labels.includes(label.id)).length
  const labels = cases.labels.filter(label => countIn(entries, label) > 0).sort((a, b) => countIn(entries, b) - countIn(entries, a))
  const shown = selectedMetric === metric ? entries.filter(entry => entry.labels.includes(selectedLabel)) : []

  return <>
    <h2>{CASE_METRICS[metric].name}</h2>
    <p className="description">{OVERVIEW_DESCRIPTIONS[metric](overviewTool)}</p>
    {entries.length === 0
      ? <p className="description">No annotated cases yet.</p>
      : (
        <div className="table-wrapper">
          <table>
            <thead><tr>{['label', 'total', ...columns.map(column => column.header)].map(header => <th key={header}>{header}</th>)}</tr></thead>
            <tbody>
              {labels.map(label => {
                const key = `${metric}/${label.id}`
                return (
                  <tr key={label.id} className={`clickable ${state.label === key ? 'selected' : ''}`} title={label.rule} onClick={() => update({ label: state.label === key ? '' : key })}>
                    <td>{label.name}<LabelHelp id={label.id} /></td>
                    <td>{withPercentage(countIn(entries, label), entries.length)}</td>
                    {columns.map(column => <td key={column.header}>{withPercentage(countIn(column.entries, label), column.entries.length)}</td>)}
                  </tr>
                )
              })}
              <tr className="total">
                <td>annotated cases</td>
                <td>{entries.length}</td>
                {columns.map(column => <td key={column.header}>{column.entries.length}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    {shown.length > 0 && <>
      <h2>{CASE_METRICS[metric].name} cases: {labelName(selectedLabel)}</h2>
      <div className="table-wrapper">
        <table>
          <thead><tr>{['project', 'file', 'group', 'outcome', 'note'].map(header => <th key={header}>{header}</th>)}</tr></thead>
          <tbody>
            {shown.map(({ info, group, labels, note }) => (
              <tr key={`${info.id}/${group.id}`} className="clickable" onClick={() => update({ case: info.id, outputLeft: group.tool, outputRight: group.otherTool ?? '' })}>
                <td>{info.project}</td>
                <td className="text">{info.filepath}</td>
                <td>{pairTitle(group)}</td>
                <LabelsCell labels={labels} />
                <td className="text">{note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>}
  </>
}

export const Overview = ({ groups, overviewTool }: { groups: CaseGroup[], overviewTool: string }) => {
  const summaries = Object.values(useCases().cases)
  return <>
    <p className="description">
      {summaries.filter(info => info.annotation).length} of {summaries.length} selected cases annotated. Tables count outcome labels: why each case is in its group.
      A case can have several outcome labels per group, so a column can add up to more than 100%; a case in several groups of a column counts once per group.
      Click a label to list its cases; click ? for its definition, or the ? button at the bottom right for all of them.
    </p>
    {(Object.keys(CASE_METRICS) as Metric[]).map(metric => <MetricTable key={metric} metric={metric} groups={groups} overviewTool={overviewTool} />)}
  </>
}
