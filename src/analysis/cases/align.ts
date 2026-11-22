import { readFile } from '../../utils/file.js'
import { diffFiles } from '../../utils/git.js'
import { runCommand } from '../../utils/process.js'
import { AlignedCell, AlignedRow, Change } from './types.js'

const CONTEXT = 3
const MAX_ROWS = 3000

const FILES = ['left', 'base', 'right'] as const

type FileName = (typeof FILES)[number]

type Range = { start: number, count: number }

type Chunk = Record<FileName, Range> & { change: Change }

const CHUNK_CHANGES: Record<string, Change> = { '': 'both', '1': 'changed', '2': 'both', '3': 'changed' }

const splitLines = (content: string) => {
  const lines = content.split(/\r?\n/)
  return lines[lines.length - 1] === '' ? lines.slice(0, -1) : lines
}

const parseRange = (first: string, last: string | undefined, type: string): Range => type === 'a'
  ? { start: Number(first), count: 0 }
  : { start: Number(first) - 1, count: Number(last ?? first) - Number(first) + 1 }

const getChunks = (paths: Record<FileName, string>): Chunk[] => {
  const output = runCommand('diff3', [paths.left, paths.base, paths.right], { isSuccess: code => code === 0 || code === 1 }) ?? ''
  const chunks: Partial<Chunk>[] = []

  output.split('\n').forEach(line => {
    const header = line.match(/^====([123]?)$/)
    if (header) {
      chunks.push({ change: CHUNK_CHANGES[header[1]] })
      return
    }

    const range = line.match(/^([123]):(\d+)(?:,(\d+))?([ac])$/)
    if (range && chunks.length > 0) {
      const [, file, first, last, type] = range
      chunks[chunks.length - 1][FILES[Number(file) - 1]] = parseRange(first, last, type)
    }
  })

  return chunks as Chunk[]
}

const getChangedSideLines = (basePath: string, sidePath: string) => {
  const changed = new Set<number>()
  const hunks = diffFiles(basePath, sidePath, 0).matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)

  for (const [, first, count] of hunks) {
    for (let offset = 0; offset < Number(count ?? 1); offset++) changed.add(Number(first) - 1 + offset)
  }

  return changed
}

export const alignFiles = (paths: Record<FileName, string>): AlignedRow[] => {
  const lines = { left: splitLines(readFile(paths.left)), base: splitLines(readFile(paths.base)), right: splitLines(readFile(paths.right)) }
  const position = { left: 0, base: 0, right: 0 }
  const rows: AlignedRow[] = []

  const changedLeftLines = getChangedSideLines(paths.base, paths.left)
  const changedRightLines = getChangedSideLines(paths.base, paths.right)
  const sideChange = (changed: Set<number>, index: number): Change => changed.has(index) ? 'changed' : 'same'

  const cell = (file: FileName, index: number, change: Change): AlignedCell => [index + 1, lines[file][index], change]

  const pushUnchanged = (count: number, isFirst: boolean, isLast: boolean) => {
    const show = (offset: number) => rows.push([
      cell('base', position.base + offset, 'same'),
      cell('left', position.left + offset, 'same'),
      cell('right', position.right + offset, 'same')
    ])

    const head = isFirst ? 0 : CONTEXT
    const tail = isLast ? 0 : CONTEXT
    if (count <= head + tail + 1) {
      for (let offset = 0; offset < count; offset++) show(offset)
    } else {
      for (let offset = 0; offset < head; offset++) show(offset)
      rows.push(['gap', count - head - tail])
      for (let offset = count - tail; offset < count; offset++) show(offset)
    }

    FILES.forEach(file => { position[file] += count })
  }

  const chunks = getChunks(paths)
  chunks.forEach((chunk, index) => {
    pushUnchanged(chunk.base.start - position.base, index === 0, false)

    const { left, base, right } = chunk
    const height = Math.max(left.count, base.count, right.count)
    for (let offset = 0; offset < height; offset++) {
      const [baseIndex, leftIndex, rightIndex] = [base.start + offset, left.start + offset, right.start + offset]
      rows.push([
        offset < base.count ? cell('base', baseIndex, chunk.change) : null,
        offset < left.count ? cell('left', leftIndex, sideChange(changedLeftLines, leftIndex)) : null,
        offset < right.count ? cell('right', rightIndex, sideChange(changedRightLines, rightIndex)) : null
      ])
    }

    FILES.forEach(file => { position[file] = chunk[file].start + chunk[file].count })
  })

  pushUnchanged(lines.base.length - position.base, chunks.length === 0, true)

  return rows.length > MAX_ROWS ? [...rows.slice(0, MAX_ROWS), ['gap', rows.length - MAX_ROWS] satisfies AlignedRow] : rows
}
