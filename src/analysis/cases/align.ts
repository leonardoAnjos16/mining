import { readFile } from '../../utils/file.js'
import { diffFiles } from '../../utils/git.js'
import { AlignedCell, AlignedRow, Change } from './types.js'

const CONTEXT = 3
const MAX_ROWS = 3000

type Hunk = { baseStart: number, baseCount: number, sideStart: number, sideCount: number }

const getHunks = (basePath: string, sidePath: string): Hunk[] =>
  Array.from(diffFiles(basePath, sidePath, 0).matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm), match => {
    const baseCount = match[2] === undefined ? 1 : Number(match[2])
    const sideCount = match[4] === undefined ? 1 : Number(match[4])
    return {
      baseStart: baseCount === 0 ? Number(match[1]) : Number(match[1]) - 1,
      baseCount,
      sideStart: sideCount === 0 ? Number(match[3]) : Number(match[3]) - 1,
      sideCount
    }
  })

const getRegions = (hunks: Hunk[]) => {
  const intervals = hunks.map(({ baseStart, baseCount }) => [baseStart, baseStart + baseCount]).sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const regions: number[][] = []

  intervals.forEach(([start, end]) => {
    const last = regions[regions.length - 1]
    if (last && start <= last[1]) last[1] = Math.max(last[1], end)
    else regions.push([start, end])
  })

  return regions
}

const toSide = (hunks: Hunk[], position: number, includeInsertionsAt: boolean) => position + hunks
  .filter(({ baseStart, baseCount }) => baseStart + baseCount <= position && (includeInsertionsAt || baseStart < position))
  .reduce((total, { baseCount, sideCount }) => total + sideCount - baseCount, 0)

const getSideRange = (hunks: Hunk[], start: number, end: number) => {
  const inside = hunks.filter(({ baseStart, baseCount }) => baseStart >= start && baseStart + baseCount <= end)
  const sideStart = toSide(hunks, start, false)
  const sideEnd = sideStart + (end - start) + inside.reduce((total, { baseCount, sideCount }) => total + sideCount - baseCount, 0)

  const changed = new Set(inside.flatMap(({ sideStart, sideCount }) => Array.from({ length: sideCount }, (_, index) => sideStart + index)))
  return { sideStart, sideEnd, changed }
}

const splitLines = (content: string) => {
  const lines = content.split(/\r?\n/)
  return lines[lines.length - 1] === '' ? lines.slice(0, -1) : lines
}

export const alignSides = (paths: { base: string, left: string, right: string }) => {
  const lines = { base: splitLines(readFile(paths.base)), left: splitLines(readFile(paths.left)), right: splitLines(readFile(paths.right)) }
  const hunks = { left: getHunks(paths.base, paths.left), right: getHunks(paths.base, paths.right) }
  const regions = getRegions([...hunks.left, ...hunks.right])

  const changedLines = (sideHunks: Hunk[]) => new Set(sideHunks.flatMap(({ baseStart, baseCount }) => Array.from({ length: baseCount }, (_, index) => baseStart + index)))
  const changedByLeft = changedLines(hunks.left)
  const changedByRight = changedLines(hunks.right)
  const baseChange = (index: number): Change => changedByLeft.has(index) && changedByRight.has(index)
    ? 'both'
    : changedByLeft.has(index) || changedByRight.has(index) ? 'changed' : 'same'
  const rows: AlignedRow[] = []

  const cell = (side: 'base' | 'left' | 'right', index: number, change: Change): AlignedCell => [index + 1, lines[side][index], change]
  const sideChange = (changed: boolean): Change => changed ? 'changed' : 'same'

  const pushUnchanged = (from: number, to: number, isFirst: boolean, isLast: boolean) => {
    const show = (index: number) => rows.push([
      cell('base', index, 'same'),
      cell('left', toSide(hunks.left, index, true), 'same'),
      cell('right', toSide(hunks.right, index, true), 'same')
    ])

    const head = isFirst ? 0 : CONTEXT
    const tail = isLast ? 0 : CONTEXT
    if (to - from <= head + tail + 1) {
      for (let index = from; index < to; index++) show(index)
      return
    }

    for (let index = from; index < from + head; index++) show(index)
    rows.push(['gap', to - from - head - tail])
    for (let index = to - tail; index < to; index++) show(index)
  }

  let position = 0
  regions.forEach(([start, end], regionIndex) => {
    pushUnchanged(position, start, regionIndex === 0, false)

    const left = getSideRange(hunks.left, start, end)
    const right = getSideRange(hunks.right, start, end)
    const height = Math.max(end - start, left.sideEnd - left.sideStart, right.sideEnd - right.sideStart)

    for (let offset = 0; offset < height; offset++) {
      const baseIndex = start + offset
      const leftIndex = left.sideStart + offset
      const rightIndex = right.sideStart + offset
      rows.push([
        baseIndex < end ? cell('base', baseIndex, baseChange(baseIndex)) : null,
        leftIndex < left.sideEnd ? cell('left', leftIndex, sideChange(left.changed.has(leftIndex))) : null,
        rightIndex < right.sideEnd ? cell('right', rightIndex, sideChange(right.changed.has(rightIndex))) : null
      ])
    }

    position = end
  })

  pushUnchanged(position, lines.base.length, regions.length === 0, true)

  return rows.length > MAX_ROWS ? [...rows.slice(0, MAX_ROWS), ['gap', rows.length - MAX_ROWS] satisfies AlignedRow] : rows
}
