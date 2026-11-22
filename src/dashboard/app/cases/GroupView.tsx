import type { CaseGroup } from '../../../analysis/cases/types'
import { Badge } from '../components/Badge'
import { LabelHelp, LabelsCell, useLabelName } from '../components/LabelHelp'
import { CASE_METRICS } from '../constants'
import { useApp, useCases } from '../context'
import { getOutcome } from '../helpers'

export const GroupView = ({ group }: { group: CaseGroup }) => {
  const { state, update } = useApp()
  const cases = useCases()
  const labelName = useLabelName()
  const groupCases = group.cases.map(id => cases.cases[id]).filter(Boolean)
  const annotated = groupCases.filter(info => getOutcome(info, group.id))

  const labelCounts = cases.labels
    .map(label => ({ label, count: annotated.filter(info => getOutcome(info, group.id)?.label === label.id).length }))
    .filter(({ count }) => count > 0)
    .sort((a, b) => b.count - a.count)

  const shown = state.label ? groupCases.filter(info => getOutcome(info, group.id)?.label === state.label) : groupCases

  return <>
    <p className="description">
      {CASE_METRICS[group.metric].description(group.tool, group.otherTool)} {group.cases.length} of {group.total} files selected at random; {annotated.length} annotated. All scopes and files, regardless of the selectors.
    </p>
    <h2>Outcomes</h2>
    {annotated.length === 0
      ? <p className="description">No annotations yet: run the annotate-cases skill.</p>
      : <div>
        <p className="description">Each annotated case has one outcome label for this group: why it is in it. Click a label to filter the cases; click ? for its definition, or the ? button at the bottom right for all of them.</p>
        <table>
          <thead><tr><th>label</th><th>cases</th><th>% of annotated</th></tr></thead>
          <tbody>
            {labelCounts.map(({ label, count }) => (
              <tr key={label.id} className={`clickable ${state.label === label.id ? 'selected' : ''}`} title={label.rule} onClick={() => update({ label: state.label === label.id ? '' : label.id })}>
                <td>{label.name}<LabelHelp id={label.id} /></td>
                <td>{count}</td>
                <td>{Math.round(count / annotated.length * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>}
    <h2>{state.label ? `Cases: ${labelName(state.label)}` : 'Cases'}</h2>
    <div className="table-wrapper">
      <table>
        <thead><tr>{['project', 'file', 'status', 'outcome', 'note'].map(header => <th key={header}>{header}</th>)}</tr></thead>
        <tbody>
          {shown.map(info => {
            const outcome = getOutcome(info, group.id)
            return (
              <tr key={info.id} className="clickable" onClick={() => update({ group: group.id, case: info.id, outputLeft: '', outputRight: '' })}>
                <td>{info.project}</td>
                <td className="text">{info.filepath}</td>
                <td><Badge className={`status-${info.status}`}>{info.status}</Badge></td>
                <LabelsCell labels={outcome ? [outcome.label] : []} />
                <td className="text">{outcome?.note ?? ''}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  </>
}
