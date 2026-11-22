import { useApp } from '../context'
import { Badge } from './Badge'
import { PopoverButton } from './Popover'

const useLabel = () => {
  const { cases } = useApp()
  return (id: string) => cases?.labels.find(label => label.id === id)
}

export const useLabelName = () => {
  const findLabel = useLabel()
  return (id: string) => findLabel(id)?.name ?? id
}

export const LabelHelp = ({ id }: { id: string }) => {
  const label = useLabel()(id)
  if (!label) return null
  return (
    <PopoverButton popoverKey={`label/${id}`} title={`What does "${label.name}" mean?`} content={() => <>
      <strong>{label.name}</strong>
      <p>{label.rule}</p>
      {label.example && <p className="example">Example: {label.example}</p>}
    </>}>?</PopoverButton>
  )
}

export const LabelPill = ({ id }: { id: string }) => {
  const labelName = useLabelName()
  return <><Badge className="label-pill">{labelName(id)}</Badge><LabelHelp id={id} /></>
}

export const LabelsCell = ({ labels }: { labels: string[] }) => {
  const labelName = useLabelName()
  return <td className="text"><div className="pills">{labels.map(label => <Badge key={label} className="label-pill">{labelName(label)}</Badge>)}</div></td>
}
