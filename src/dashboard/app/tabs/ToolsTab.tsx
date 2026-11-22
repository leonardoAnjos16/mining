import { CsvTitle, DataTable, Describe, MissingTable } from '../components/DataTable'
import { CORRECTNESS_COLUMNS, TOOL_COLUMNS } from '../constants'
import { useApp } from '../context'
import { getDir } from '../helpers'

const formatPercentageColumns = (value: string | number, header: string) => header.endsWith(' %') ? `${value}%` : value

export const ToolsTab = () => {
  const { state, analysis } = useApp()
  const dir = getDir(state)
  if (!analysis.tables[`${dir}/tools.csv`]) return <MissingTable file={`${dir}/tools.csv`} />

  return <>
    <CsvTitle title="Results per tool" file={`${dir}/tools.csv`} />
    <p className="description">Conflicts only count files where every tool succeeded.</p>
    <DataTable file={`${dir}/tools.csv`} formatCell={formatPercentageColumns} />
    <Describe descriptions={TOOL_COLUMNS} />
    <CsvTitle title="Correctness" file={`${dir}/correctness.csv`} />
    <p className="description">Each output compared with the merge commit, ignoring whitespace. Only files where every tool succeeded; the three counts of a row add up to those files.</p>
    <DataTable file={`${dir}/correctness.csv`} formatCell={formatPercentageColumns} />
    <Describe descriptions={CORRECTNESS_COLUMNS} />
  </>
}
