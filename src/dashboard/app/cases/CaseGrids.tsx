import type { ReactNode } from 'react'
import type { AlignedRow, CaseGroup, CaseSummary, ToolFacts } from '../../../analysis/cases/types'
import { Badge } from '../components/Badge'
import { LabelPill } from '../components/LabelHelp'
import { PopoverButton } from '../components/Popover'
import { STATES } from '../constants'
import { useApp } from '../context'
import { useCaseData } from '../data'
import { AlignedGrid, MERGE_LAYOUT, type Header } from './AlignedGrid'

const AnnotationButton = ({ popoverKey, title, text, children }: { popoverKey: string, title: string, text?: string, children: ReactNode }) => text
  ? <PopoverButton popoverKey={popoverKey} title={`Show the ${title.toLowerCase()}`} className="note-toggle"
    content={() => <><strong>{title}</strong><p>{text}</p></>}>{children}</PopoverButton>
  : null

const describeFacts = ({ state, conflicts, conflictBlocks, missingLines, extraLines, missingMergeOnlyLines, sameLinesDifferentOrder }: ToolFacts) => {
  if (state === 'conflict') {
    const equalSides = conflictBlocks.some(block => block.sidesEqualIgnoringWhitespace) ? ', some with equal sides' : ''
    return `${conflicts} conflict${conflicts === 1 ? '' : 's'}${equalSides}`
  }
  if (state === 'clean-different') {
    const mergeOnly = missingMergeOnlyLines ? `, ${missingMergeOnlyLines} missing lines only in the merge commit` : ''
    const order = sameLinesDifferentOrder ? ', same lines in a different order' : ''
    return `${missingLines} lines missing, ${extraLines} extra${mergeOnly}${order}`
  }
  return ''
}

const ToolCards = ({ info, tools }: { info: CaseSummary, tools: string[] }) => {
  const cards = tools.map(tool => {
    const labels = info.annotation?.tools?.[tool]?.labels ?? []
    const facts = describeFacts(info.tools[tool])
    return labels.length === 0 && !facts ? null : (
      <div className="annotation-card">
        {labels.length > 0 && <div className="card-labels">{labels.map(label => <LabelPill key={label} id={label} />)}</div>}
        {facts && <p className="facts">{facts}</p>}
      </div>
    )
  })
  if (cards.every(card => card === null)) return null

  return (
    <div className="annotation-strip">
      {cards[0] ?? <div className="annotation-card empty" />}
      <div className="annotation-card empty" />
      {cards[1] ?? <div className="annotation-card empty" />}
    </div>
  )
}

const getShownTools = (group: CaseGroup | undefined, outputTools: string[], state: { outputLeft: string, outputRight: string }) => {
  const pick = (value: string, fallback?: string) => outputTools.includes(value) ? value : fallback
  const left = pick(state.outputLeft, group?.tool) ?? outputTools[0]
  const right = pick(state.outputRight, group?.otherTool ?? outputTools.find(tool => tool !== group?.tool))
  return [left, right !== left ? right : outputTools.find(tool => tool !== left)] as const
}

const getOutputRows = (outputs: Record<string, AlignedRow[]>, left: string, right: string) => {
  const [first, second] = [left, right].sort()
  const rows = outputs[`${first}|${second}`]
  return rows && first !== left ? rows.map(row => row[0] === 'gap' ? row : [row[0], row[2], row[1]] as AlignedRow) : rows
}

export const CaseGrids = ({ info, group }: { info: CaseSummary, group?: CaseGroup }) => {
  const { state, update, hidden } = useApp()
  const { data, error } = useCaseData(info.id)
  if (error) return <p>{error}</p>
  if (!data) return <p className="loading">Loading…</p>

  const summary = info.annotation?.summary
  const outputTools = Object.keys(info.tools).filter(tool => info.tools[tool].state !== 'failed' && !hidden.has(tool))
  const [left, right] = getShownTools(group, outputTools, state)
  const outputRows = right ? getOutputRows(data.outputs, left, right) : undefined

  const summaryButton = (name: 'left' | 'right' | 'merge', title: string) =>
    <AnnotationButton popoverKey={`summary/${info.id}/${name}`} title={`${title} summary`} text={summary?.[name]}>Summary</AnnotationButton>

  const toolHeader = (tool: string, key: 'outputLeft' | 'outputRight', otherTool?: string): Header => ({
    main: <>
      <select value={tool} onChange={event => update({ [key]: event.target.value })}>
        {outputTools.filter(name => name !== otherTool).map(name => <option key={name} value={name}>{name}</option>)}
      </select>
      <Badge className={`state-${info.tools[tool].state}`}>{STATES[info.tools[tool].state]}</Badge>
    </>,
    action: <AnnotationButton popoverKey={`note/${info.id}/${tool}`} title={`Note on ${tool}`} text={info.annotation?.tools?.[tool]?.note}>Note</AnnotationButton>
  })

  return <>
    <p className="files">Files: {Object.entries(info.files).map(([name, file]) => <a key={name} href={`cases/${info.id}/${file}`} target="_blank" rel="noreferrer">{name}</a>)}</p>

    <div className="case-section">
      <h3>Left, base and right</h3>
      <p className="description">Aligned as diff3 sees the files: rows outside a changed chunk are unchanged lines, and inside a chunk each column lists its lines top to bottom. Base lines in a chunk are yellow when one side changed it, purple when both did; green lines are a side's own changes. Long unchanged runs are collapsed.</p>
      <AlignedGrid rows={data.aligned} language={info.language} headers={[
        { main: 'Left', action: summaryButton('left', 'Left') },
        { main: 'Base' },
        { main: 'Right', action: summaryButton('right', 'Right') }
      ]} />
    </div>

    <div className="case-section">
      <h3>Base and merge commit</h3>
      <p className="description">Red base lines were removed or replaced in the merge commit, green lines are what the merge commit has instead.</p>
      <AlignedGrid rows={data.merge} language={info.language} layout={MERGE_LAYOUT} headers={[
        { main: 'Base' },
        { main: 'Merge commit', action: summaryButton('merge', 'Merge commit') }
      ]} />
    </div>

    <div className="case-section">
      <h3>Tool outputs and merge commit</h3>
      <p className="description">Each output aligned against the merge commit. Yellow merge lines differ in one output, purple ones in both; green lines are where an output differs from the merge commit. Pick the tools in the column headers.</p>
      {outputRows && right
        ? <>
          <ToolCards info={info} tools={[left, right]} />
          <AlignedGrid rows={outputRows} language={info.language} headers={[
            toolHeader(left, 'outputLeft', right),
            { main: 'Merge commit' },
            toolHeader(right, 'outputRight', left)
          ]} />
        </>
        : <p className="description">{outputTools.length < 2 ? 'Show at least two tools to compare their outputs.' : 'Run "analysis cases" again to compute the aligned outputs.'}</p>}
    </div>
  </>
}
