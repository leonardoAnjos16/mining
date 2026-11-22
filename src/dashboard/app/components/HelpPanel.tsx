import type { Label } from '../../../analysis/cases/types'
import { LABEL_KINDS } from '../constants'
import { useApp } from '../context'
import { Badge } from './Badge'

const LabelTable = ({ labels, kind }: { labels: Label[], kind: Label['kind'] }) => {
  if (labels.length === 0) return <p className="description">No labels yet.</p>
  return (
    <div className="table-wrapper">
      <table>
        <thead><tr><th>label</th><th className="applies-to">applies to</th><th>rule</th><th>example</th></tr></thead>
        <tbody>
          {labels.map(label => (
            <tr key={label.id}>
              <td>{label.name}</td>
              <td className="applies-to">
                <div className="pills">
                  {label.appliesTo.map(value => <Badge key={value} className={kind === 'behavior' ? `state-${value}` : ''}>{LABEL_KINDS[kind].appliesName(value)}</Badge>)}
                </div>
              </td>
              <td className="text">{label.rule}</td>
              <td className="text">{label.example ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export const HelpPanel = ({ metric, open, setOpen }: { metric: string, open: boolean, setOpen: (open: boolean) => void }) => {
  const { cases } = useApp()
  if (!cases) return null

  const labelsOf = (kind: Label['kind']) => cases.labels
    .filter(label => label.kind === kind && (kind !== 'outcome' || !metric || label.appliesTo.includes(metric)))
    .sort((a, b) => a.name.localeCompare(b.name))

  return <>
    <button id="help-button" title="Label definitions" onClick={() => setOpen(!open)}>?</button>
    {open && (
      <aside id="help-panel">
        <div className="panel-header"><h2>Label definitions</h2><button onClick={() => setOpen(false)}>Close</button></div>
        {(Object.keys(LABEL_KINDS) as Label['kind'][]).map(kind => (
          <div key={kind}>
            <h3>{LABEL_KINDS[kind].title}</h3>
            <p className="description">{LABEL_KINDS[kind].description}</p>
            <LabelTable labels={labelsOf(kind)} kind={kind} />
          </div>
        ))}
      </aside>
    )}
  </>
}
