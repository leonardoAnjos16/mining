import { CsvTitle, DataTable, getVisible, MissingTable } from '../components/DataTable'
import { PAIR_METRICS } from '../constants'
import { useApp } from '../context'
import { getDir } from '../helpers'

export const PairsTab = () => {
  const { state, update, analysis, hidden } = useApp()
  const dir = getDir(state)
  if (!analysis.tables[`${dir}/tools.csv`]) return <MissingTable file={`${dir}/tools.csv`} />
  if (!analysis.tables[`${dir}/compared.csv`]) return <p>No files where every tool succeeded in this scope.</p>

  const { base, description } = PAIR_METRICS[state.metric] ?? PAIR_METRICS.afp
  const percentage = Boolean(base) && state.percentage === '1'
  const file = `${dir}/${state.metric}${percentage ? '-percentage' : ''}.csv`
  const table = analysis.tables[file]
  const count = analysis.tables[`${dir}/${state.metric}.csv`]
  const total = base ? analysis.tables[`${dir}/${base}.csv`] : undefined

  const visible = table ? getVisible(table, hidden) : { rows: [], columns: [] }
  const values = visible.rows.flatMap(({ row }) => visible.columns.slice(1).map(index => row[index])).filter(value => value !== '').map(Number)
  const max = Math.max(...values, 0)

  return <>
    <div className="controls">
      <label>Metric{' '}
        <select value={state.metric} onChange={event => update({ metric: event.target.value })}>
          {Object.keys(PAIR_METRICS).map(name => <option key={name} value={name}>{name}</option>)}
        </select>
      </label>
      {base && (
        <label>
          <input type="checkbox" checked={percentage} onChange={event => update({ percentage: event.target.checked ? '1' : '0' })} />
          Percentage of {base}
        </label>
      )}
    </div>
    <p className="description">{description} Rows are the tool, columns the other tool.</p>
    <CsvTitle title={state.metric} file={file} />
    <DataTable
      file={file}
      formatCell={value => percentage ? `${value}%` : value}
      styleCell={value => max > 0 ? { background: `rgba(9, 105, 218, ${(0.05 + 0.45 * Number(value) / max).toFixed(2)})` } : undefined}
      titleCell={(row, column) => total && count ? `${count.rows[row][column]} of ${total.rows[row][column]} ${base}` : undefined}
    />
  </>
}
