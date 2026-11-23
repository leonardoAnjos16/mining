import { Fragment, type CSSProperties, type ReactNode } from 'react'
import { useApp } from '../context'

type Value = string | number

type DataTableProps = {
  file: string
  formatCell?: (value: Value, header: string) => ReactNode
  styleCell?: (value: Value) => CSSProperties | undefined
  titleCell?: (row: number, column: number) => string | undefined
}

const FIRST_COLUMN_WIDTH = 200
const COLUMN_WIDTH = 130

export const MissingTable = ({ file }: { file: string }) =>
  <p className="description">{file} is missing: run "analysis metrics" with this alias.</p>

export const CsvTitle = ({ title, file }: { title: string, file: string }) =>
  <h2>{title}<a className="csv-link" href={file}>{file}</a></h2>

export const getVisible = ({ headers, rows }: { headers: string[], rows: Value[][] }, hidden: Set<string>) => ({
  columns: headers.map((_, index) => index).filter(index => index === 0 || !hidden.has(headers[index])),
  rows: rows.map((row, index) => ({ row, index })).filter(({ row }) => !hidden.has(String(row[0])))
})

export const DataTable = ({ file, formatCell = value => value, styleCell, titleCell }: DataTableProps) => {
  const { analysis, hidden, toggleHidden } = useApp()
  const table = analysis.tables[file]
  if (!table) return <MissingTable file={file} />

  const { columns, rows } = getVisible(table, hidden)
  return (
    <div className="table-wrapper">
      <table className="data-table" style={{ width: FIRST_COLUMN_WIDTH + COLUMN_WIDTH * (columns.length - 1) }}>
        <colgroup>{columns.map((column, index) => <col key={column} style={{ width: index === 0 ? FIRST_COLUMN_WIDTH : COLUMN_WIDTH }} />)}</colgroup>
        <thead><tr>{columns.map(column => <th key={column}>{table.headers[column]}</th>)}</tr></thead>
        <tbody>
          {rows.map(({ row, index: rowIndex }) => (
            <tr key={rowIndex} className={row[0] === 'total' ? 'total' : ''}>
              {columns.map(column => {
                const value = row[column]
                if (column === 0) {
                  return (
                    <td key={column}>
                      {value !== 'total' && <button className="hide" title={`Hide ${value}`} onClick={() => toggleHidden(String(value))}>×</button>}
                      {value}
                    </td>
                  )
                }
                if (value === '') return <td key={column} className="empty" />
                return <td key={column} style={styleCell?.(value)} title={titleCell?.(rowIndex, column)}>{formatCell(value, table.headers[column])}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export const Describe = ({ descriptions }: { descriptions: Record<string, string> }) => (
  <dl>
    {Object.entries(descriptions).map(([name, description]) => <Fragment key={name}><dt>{name}</dt><dd>{description}</dd></Fragment>)}
  </dl>
)
