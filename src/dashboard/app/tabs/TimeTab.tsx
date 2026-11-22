import { CsvTitle, MissingTable } from '../components/DataTable'
import { TIME_PLOTS } from '../constants'
import { useApp } from '../context'
import { getDir } from '../helpers'

export const TimeTab = () => {
  const { state, update, analysis } = useApp()
  const dir = getDir(state)
  if (!analysis.tables[`${dir}/tools.csv`]) return <MissingTable file={`${dir}/tools.csv`} />
  if (!analysis.tables[`${dir}/compared.csv`]) return <p>No files where every tool succeeded in this scope.</p>

  const file = `${dir}/boxplot-${state.time}.svg`
  return <>
    <div className="controls">
      <label>Time{' '}
        <select value={state.time} onChange={event => update({ time: event.target.value })}>
          {Object.entries(TIME_PLOTS).map(([name, label]) => <option key={name} value={name}>{label}</option>)}
        </select>
      </label>
    </div>
    <p className="description">One point per file and tool, only for files where every tool succeeded. Log scale.</p>
    <CsvTitle title="Time per file" file={file} />
    <img src={file} alt={`Box plot: ${TIME_PLOTS[state.time]}`} />
  </>
}
