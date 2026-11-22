import { useEffect, useRef } from 'react'
import * as Plot from '@observablehq/plot'
import { CsvTitle } from '../components/DataTable'
import { TIME_PLOTS, TIME_SCALES } from '../constants'
import { useApp } from '../context'
import { getDir } from '../helpers'
import type { State } from '../state'

const TIMES_FILE = 'times.csv'

type Time = { tool: string, mean: number, project: string, file: string }

type TipPoint = { tool: string, mean: number, title: string }

type Table = { headers: string[], rows: (string | number)[][] }

const SUBSET_FILTERS: Record<string, (sameSides: string) => boolean> = {
  'all': () => true,
  'different-sides': sameSides => sameSides === 'false',
  'same-sides': sameSides => sameSides === 'true'
}

const matchesScope = (scope: string, project: string, language: string) => {
  const [kind, name] = scope.split('/')
  if (kind === 'languages') return language === name
  if (kind === 'projects') return project === name
  return true
}

const getTimes = (table: Table, state: State, hidden: Set<string>) => {
  const column = (name: string) => table.headers.indexOf(name)
  const aggregation = TIME_PLOTS[state.time] ? state.time : 'trimmed'
  const [project, language, file, sameSides, tool, mean] = ['project', 'language', 'file', 'same sides', 'tool', aggregation].map(column)
  const includeSubset = SUBSET_FILTERS[state.subset] ?? SUBSET_FILTERS.all

  const rows = table.rows.filter(row =>
    includeSubset(String(row[sameSides])) &&
    matchesScope(state.scope, String(row[project]), String(row[language])) &&
    !hidden.has(String(row[tool])))

  const values = rows.filter(row => row[mean] !== '').map(row => ({
    tool: String(row[tool]),
    mean: Number(row[mean]),
    project: String(row[project]),
    file: String(row[file])
  }))
  return { values, skipped: rows.length - values.length }
}

const quantile = (sorted: number[], fraction: number) => {
  const position = (sorted.length - 1) * fraction
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower)
}

const formatTime = (milliseconds: number) => milliseconds >= 1000
  ? `${(milliseconds / 1000).toFixed(2)} s`
  : `${milliseconds.toFixed(milliseconds < 10 ? 2 : 1)} ms`

const describeTimes = (sorted: number[]) => [
    `files: ${sorted.length}`,
    `min: ${formatTime(sorted[0])}`,
    `25%: ${formatTime(quantile(sorted, 0.25))}`,
    `median: ${formatTime(quantile(sorted, 0.5))}`,
    `75%: ${formatTime(quantile(sorted, 0.75))}`,
    `max: ${formatTime(sorted[sorted.length - 1])}`
  ].join('\n')

const getTipPoints = (times: Time[], tools: string[]): TipPoint[] => tools.flatMap(tool => {
  const toolTimes = times.filter(time => time.tool === tool)
  const sorted = toolTimes.map(({ mean }) => mean).sort((a, b) => a - b)
  const [lower, upper] = [quantile(sorted, 0.25), quantile(sorted, 0.75)]
  const isOutlier = (mean: number) => mean < lower - 1.5 * (upper - lower) || mean > upper + 1.5 * (upper - lower)

  return [
    { tool, mean: quantile(sorted, 0.5), title: describeTimes(sorted) },
    ...toolTimes.filter(({ mean }) => isOutlier(mean)).map(({ mean, project, file }) => ({ tool, mean, title: `${project}\n${file}\n${formatTime(mean)}` }))
  ]
})

const MAX_WIDTH = 1400

const getTicks = (times: Time[]) => {
  const means = times.map(({ mean }) => mean).filter(mean => mean > 0)
  const [min, max] = [Math.min(...means), Math.max(...means)]
  const ticks: number[] = []
  for (let power = Math.floor(Math.log10(min)); power <= Math.ceil(Math.log10(max)); power++) {
    ticks.push(...[1, 2, 5].map(step => step * 10 ** power).filter(tick => tick >= min / 2 && tick <= max * 2))
  }
  return ticks
}

const formatTick = (milliseconds: number) => milliseconds >= 1000 ? `${milliseconds / 1000} s` : `${milliseconds} ms`

const getUpperWhisker = (times: Time[], tools: string[]) => Math.max(...tools.map(tool => {
  const sorted = times.filter(time => time.tool === tool).map(({ mean }) => mean).sort((a, b) => a - b)
  const [lower, upper] = [quantile(sorted, 0.25), quantile(sorted, 0.75)]
  return Math.max(...sorted.filter(mean => mean <= upper + 1.5 * (upper - lower)))
}))

const getXScale = (scale: string, times: Time[], tools: string[]) => {
  if (scale === 'linear') return { x: { grid: true, label: 'Time per file', tickFormat: formatTick }, tickLabels: [] }
  if (scale === 'boxes') {
    const domain = [0, getUpperWhisker(times, tools) * 1.05]
    return { x: { grid: true, label: 'Time per file (outliers past the longest whisker are cut off)', tickFormat: formatTick, domain }, tickLabels: [] }
  }

  const ticks = getTicks(times)
  return { x: { grid: true, type: 'log' as const, label: 'Time per file (log scale)', ticks, tickFormat: () => '' }, tickLabels: ticks }
}

const BoxPlot = ({ times, allTools, scale }: { times: Time[], allTools: string[], scale: string }) => {
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = container.current
    if (!element) return

    const tools = Array.from(new Set(times.map(({ tool }) => tool))).sort()
    const { x, tickLabels } = getXScale(scale, times, tools)
    const plot = Plot.plot({
      width: Math.min(element.clientWidth, MAX_WIDTH),
      height: 90 + 70 * tools.length,
      marginLeft: 150,
      marginBottom: 50,
      style: { fontSize: '14px' },
      x,
      y: { label: null, domain: tools },
      color: { domain: allTools, scheme: 'tableau10' },
      marks: [
        Plot.boxX(times, { x: 'mean', y: 'tool', r: 1.5, fill: 'tool', fillOpacity: 0.35, clip: true }),
        Plot.text(tickLabels, { x: (tick: number) => tick, frameAnchor: 'bottom', dy: 18, text: formatTick }),
        Plot.tip(getTipPoints(times, tools), Plot.pointer({ x: 'mean', y: 'tool', title: 'title', lineWidth: 100 }))
      ]
    })

    element.replaceChildren(plot)
    return () => plot.remove()
  }, [times, allTools, scale])

  return <div ref={container} className="box-plot" />
}

export const TimeTab = () => {
  const { state, update, analysis, hidden } = useApp()
  const table = analysis.tables[TIMES_FILE]
  const staticPlot = `${getDir(state)}/boxplot-${state.time}.svg`

  const controls = (
    <div className="controls">
      <label>Time{' '}
        <select value={state.time} onChange={event => update({ time: event.target.value })}>
          {Object.entries(TIME_PLOTS).map(([name, label]) => <option key={name} value={name}>{label}</option>)}
        </select>
      </label>
      <label>Scale{' '}
        <select value={state.scale} onChange={event => update({ scale: event.target.value })}>
          {Object.entries(TIME_SCALES).map(([name, label]) => <option key={name} value={name}>{label}</option>)}
        </select>
      </label>
    </div>
  )

  if (!table) {
    return <>
      {controls}
      <p className="description">{TIMES_FILE} is missing: run "analysis metrics" with this alias again to draw the plot here. The static image is still available: <a href={staticPlot}>{staticPlot}</a>.</p>
    </>
  }

  const times = getTimes(table, state, hidden)
  const toolColumn = table.headers.indexOf('tool')
  const allTools = Array.from(new Set(table.rows.map(row => String(row[toolColumn])))).sort()
  return <>
    {controls}
    <p className="description">
      One point per file and tool, only for files where every tool succeeded, filtered by the selected files and scope; hidden tools are left out. Hover a box for its quartiles, or an outlier for its file.
      {times.skipped > 0 && ` ${times.skipped} results are left out because they have too few time measurements for this mean.`}
    </p>
    <CsvTitle title="Time per file" file={TIMES_FILE} />
    <p className="description">Static image of this scope, written by "analysis metrics": <a href={staticPlot}>{staticPlot}</a></p>
    {times.values.length === 0 ? <p>No times in this scope.</p> : <BoxPlot times={times.values} allTools={allTools} scale={TIME_SCALES[state.scale] ? state.scale : 'log'} />}
  </>
}
