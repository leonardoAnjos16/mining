import type { CaseGroup } from '../../../analysis/cases/types'
import { CASE_METRICS } from '../constants'
import { useApp } from '../context'

type SelectorProps = {
  label: string
  options: [string, string][]
  value: string
  disabled: boolean
  onChange: (value: string) => string
}

const Selector = ({ label, options, value, disabled, onChange }: SelectorProps) => {
  const { update } = useApp()
  const shown = options.length > 0 ? options : [['', '—'] as [string, string]]
  return (
    <label className={disabled ? 'disabled' : ''}>{label}{' '}
      <select value={value} disabled={disabled} onChange={event => update({ group: onChange(event.target.value), label: '' })}>
        {shown.map(([optionValue, text]) => <option key={optionValue} value={optionValue}>{text}</option>)}
      </select>
    </label>
  )
}

export const GroupSelectors = ({ groups, selected, overviewTool }: { groups: CaseGroup[], selected?: CaseGroup, overviewTool: string }) => {
  const tools = Array.from(new Set(groups.map(({ tool }) => tool))).sort()
  const metric = selected?.metric ?? 'all'
  const tool = selected?.tool ?? (overviewTool || tools[0])
  const otherTool = selected?.otherTool ?? groups.find(candidate => candidate.metric !== 'clean-different' && candidate.tool === tool)?.otherTool

  const findGroup = (nextMetric: string, nextTool: string, nextOtherTool?: string) => {
    if (nextMetric === 'all') return nextTool ? `all/${nextTool}` : 'all'
    const candidates = groups.filter(candidate => candidate.metric === nextMetric && candidate.tool === nextTool)
    return (candidates.find(candidate => candidate.otherTool === nextOtherTool) ?? candidates[0] ?? groups.find(candidate => candidate.metric === nextMetric))?.id ?? 'all'
  }

  const otherTools = groups.filter(candidate => candidate.metric === (metric === 'all' ? 'afp' : metric) && candidate.tool === tool && candidate.otherTool)
  const toolOptions = tools.map(name => [name, name] as [string, string])

  return (
    <div className="controls">
      <Selector label="Metric" options={[['all', 'All'], ...Object.entries(CASE_METRICS).map(([name, { name: title }]) => [name, title] as [string, string])]}
        value={metric} disabled={false} onChange={nextMetric => findGroup(nextMetric, metric === 'all' ? overviewTool : tool, otherTool)} />
      {metric === 'all'
        ? <Selector label="Tool" options={[['', 'All tools'], ...toolOptions]} value={overviewTool} disabled={false} onChange={nextTool => findGroup('all', nextTool)} />
        : <Selector label="Tool" options={toolOptions} value={tool} disabled={false} onChange={nextTool => findGroup(metric, nextTool, otherTool)} />}
      <Selector label="Other tool" options={otherTools.map(candidate => [candidate.otherTool!, candidate.otherTool!])} value={otherTool ?? ''}
        disabled={metric === 'all' || metric === 'clean-different'} onChange={nextOtherTool => findGroup(metric, tool, nextOtherTool)} />
    </div>
  )
}
