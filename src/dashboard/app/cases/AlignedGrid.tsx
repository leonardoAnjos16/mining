import { useMemo, type ReactNode } from 'react'
import type { AlignedCell, AlignedRow } from '../../../analysis/cases/types'
import { highlightLines } from '../highlight'

export type Column = { index: 0 | 1 | 2, changedClass: string, bothClass?: string }

export const SIDES_LAYOUT: Column[] = [
  { index: 1, changedClass: 'changed-side' },
  { index: 0, changedClass: 'changed-base', bothClass: 'changed-both' },
  { index: 2, changedClass: 'changed-side' }
]

export const MERGE_LAYOUT: Column[] = [
  { index: 0, changedClass: 'changed-base' },
  { index: 1, changedClass: 'changed-side' }
]

export type Header = { main: ReactNode, action?: ReactNode }

type AlignedGridProps = {
  rows: AlignedRow[]
  headers: Header[]
  layout?: Column[]
  language: string
}

const isGap = (row: AlignedRow): row is ['gap', number] => row[0] === 'gap'

export const AlignedGrid = ({ rows, headers, layout = SIDES_LAYOUT, language }: AlignedGridProps) => {
  const highlighted = useMemo(() => layout.map(({ index }) => highlightLines(
    rows.map(row => isGap(row) ? null : (row[index] as AlignedCell)?.[1] ?? null),
    language
  )), [rows, layout, language])

  const cell = (row: Exclude<AlignedRow, ['gap', number]>, rowIndex: number, column: Column, columnIndex: number) => {
    const value = row[column.index]
    if (value === null) return [<td key={`${columnIndex}n`} className="number absent" />, <td key={`${columnIndex}c`} className="absent" />]
    const [number, text, change] = value
    const className = change === 'both' ? (column.bothClass ?? column.changedClass) : change === 'changed' ? column.changedClass : ''
    const html = highlighted[columnIndex][rowIndex]
    return [
      <td key={`${columnIndex}n`} className="number">{number}</td>,
      html !== null
        ? <td key={`${columnIndex}c`} className={className} dangerouslySetInnerHTML={{ __html: html || ' ' }} />
        : <td key={`${columnIndex}c`} className={className}>{text || ' '}</td>
    ]
  }

  return (
    <div className="aligned-wrapper">
      <table className="aligned">
        <colgroup>{layout.flatMap((_, index) => [<col key={`${index}n`} className="number" />, <col key={`${index}c`} />])}</colgroup>
        <thead>
          <tr>
            {headers.map((header, index) => (
              <th key={index} colSpan={2}>
                <div className="th-content"><div className="th-main">{header.main}</div>{header.action}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => isGap(row)
            ? <tr key={rowIndex}><td className="gap" colSpan={layout.length * 2}>⋯ {row[1]} unchanged line{row[1] === 1 ? '' : 's'}</td></tr>
            : <tr key={rowIndex}>{layout.flatMap((column, columnIndex) => cell(row, rowIndex, column, columnIndex))}</tr>)}
        </tbody>
      </table>
    </div>
  )
}
