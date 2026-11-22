import { useState } from 'react'
import type { CaseGroup, CaseSummary, Metric } from '../../../analysis/cases/types'
import { LabelPill, useLabelName } from '../components/LabelHelp'
import { PopoverButton } from '../components/Popover'
import { CASE_METRICS } from '../constants'
import { useApp, useCases } from '../context'
import { getOutcome, getVisibleGroups, groupTitle } from '../helpers'

export type Origin = { group: CaseGroup } | { metric: string, tool: string, label: string }

export const Breadcrumb = ({ info, origin }: { info: CaseSummary, origin: Origin }) => {
  const { update } = useApp()
  const labelName = useLabelName()

  const back = (text: string, changes: Parameters<typeof update>[0]) =>
    <a href="#" onClick={event => { event.preventDefault(); update({ case: '', ...changes }) }}>{text}</a>

  const from = 'group' in origin
    ? groupTitle(origin.group)
    : [CASE_METRICS[origin.metric as Metric]?.name ?? 'All', origin.tool, origin.label && labelName(origin.label)].filter(Boolean).join(' · ')

  return (
    <nav className="breadcrumb">
      {back('Cases', { group: 'all', label: '' })}
      <span className="crumb-separator">›</span>
      {back(from, {})}
      <span className="crumb-separator">›</span>
      <span>{info.filepath.split('/').pop()}</span>
    </nav>
  )
}

const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    document.body.append(area)
    area.select()
    document.execCommand('copy')
    area.remove()
  }
}

export const AnnotationFile = ({ info }: { info: CaseSummary }) => {
  const [copied, setCopied] = useState(false)
  const filePath = `${useCases().annotationsPath}/${info.id}.json`
  const exists = info.annotation || info.status === 'invalid' || info.status === 'stale'

  const copy = async () => {
    await copyText(filePath)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <p className="description annotation-file">
      {exists ? 'Annotation file: ' : 'Annotation file (not created yet): '}
      <code>{filePath}</code>
      <button className="note-toggle" onClick={copy}>{copied ? 'Copied' : 'Copy path'}</button>
    </p>
  )
}

export const AnnotationErrors = ({ info }: { info: CaseSummary }) => info.errors.length === 0 ? null : (
  <div className="error-box">
    The annotation file is invalid, so it is ignored until fixed:
    <ul>{info.errors.map(error => <li key={error}>{error}</li>)}</ul>
  </div>
)

export const Outcomes = ({ info, currentGroup }: { info: CaseSummary, currentGroup?: CaseGroup }) => {
  const { hidden } = useApp()
  const caseGroups = getVisibleGroups(useCases(), hidden)
    .filter(group => info.groups.includes(group.id))
    .sort((a, b) => Number(b.id === currentGroup?.id) - Number(a.id === currentGroup?.id))
  if (caseGroups.length === 0) return null

  return (
    <div className="case-section">
      <h3>Outcomes</h3>
      <table className="outcomes">
        <tbody>
          {caseGroups.map(group => {
            const outcome = getOutcome(info, group.id)
            return (
              <tr key={group.id} className={group.id === currentGroup?.id ? 'selected' : ''}>
                <td>{groupTitle(group)}</td>
                <td>{outcome ? <div className="card-labels"><LabelPill id={outcome.label} /></div> : <span className="description">not annotated</span>}</td>
                <td>{outcome && (
                  <PopoverButton popoverKey={`outcome/${info.id}/${group.id}`} title="Show the note" className="note-toggle"
                    content={() => <><strong>{groupTitle(group)}</strong><p>{outcome.note}</p></>}>Note</PopoverButton>
                )}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
