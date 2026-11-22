import { createHash } from 'crypto'
import { diffFiles } from '../../utils/git.js'
import { ConflictBlock, ToolFacts, ToolState } from './types.js'

export type Revisions = { base: string, left: string, right: string, merge: string }

const MAX_EXAMPLES = 5
const MAX_DIFF_LINES = 400
const CONFLICT_CONTEXT = 3

const CONFLICT_START = /^<<<<<<<( |$)/
const CONFLICT_SEPARATOR = /^(\|{7}|={7})( |$)/
const CONFLICT_END = /^>>>>>>>( |$)/

export const hash = (content: string) => createHash('sha256').update(content).digest('hex').slice(0, 16)

const splitLines = (content: string) => content.split(/\r?\n/)

const normalize = (content: string) => content.replace(/\s+/g, '')

const getTrimmedLines = (content: string) => splitLines(content).map(line => line.trim()).filter(line => line !== '')

const getSideLines = ({ base, left, right }: Revisions) => new Set([...getTrimmedLines(base), ...getTrimmedLines(left), ...getTrimmedLines(right)])

const countLines = (lines: string[]) => {
  const counts = new Map<string, number>()
  lines.forEach(line => counts.set(line, (counts.get(line) ?? 0) + 1))
  return counts
}

const subtract = (counts: Map<string, number>, otherCounts: Map<string, number>) =>
  Array.from(counts).flatMap(([line, count]) => Array<string>(Math.max(0, count - (otherCounts.get(line) ?? 0))).fill(line))

const countConflicts = (content: string) => splitLines(content).filter(line => CONFLICT_START.test(line)).length

const getState = (output: string | undefined, conflicts: number, merge: string): ToolState => {
  if (output === undefined) return 'failed'
  if (conflicts > 0) return 'conflict'
  return normalize(output) === normalize(merge) ? 'clean-equal' : 'clean-different'
}

const parseConflictBlocks = (content: string): ConflictBlock[] => {
  const blocks: ConflictBlock[] = []
  let current: { startLine: number, sections: string[][] } | undefined

  splitLines(content).forEach((line, index) => {
    if (CONFLICT_START.test(line)) {
      current = { startLine: index + 1, sections: [[]] }
    } else if (current && CONFLICT_SEPARATOR.test(line)) {
      current.sections.push([])
    } else if (current && CONFLICT_END.test(line)) {
      const left = current.sections[0]
      const right = current.sections[current.sections.length - 1]
      blocks.push({ startLine: current.startLine, sidesEqualIgnoringWhitespace: normalize(left.join('')) === normalize(right.join('')) })
      current = undefined
    } else {
      current?.sections[current.sections.length - 1].push(line)
    }
  })

  return blocks
}

export const getToolFacts = (output: string | undefined, revisions: Revisions): ToolFacts => {
  const conflicts = countConflicts(output ?? '')
  const state = getState(output, conflicts, revisions.merge)

  const outputCounts = countLines(getTrimmedLines(output ?? ''))
  const mergeCounts = countLines(getTrimmedLines(revisions.merge))
  const missing = subtract(mergeCounts, outputCounts)
  const extra = subtract(outputCounts, mergeCounts)
  const sideLines = getSideLines(revisions)

  return {
    state,
    conflicts,
    conflictBlocks: parseConflictBlocks(output ?? ''),
    missingLines: missing.length,
    extraLines: extra.length,
    missingMergeOnlyLines: missing.filter(line => !sideLines.has(line)).length,
    sameLinesDifferentOrder: state === 'clean-different' && missing.length === 0 && extra.length === 0,
    missingExamples: missing.slice(0, MAX_EXAMPLES),
    extraExamples: extra.slice(0, MAX_EXAMPLES)
  }
}

export const countMergeOnlyLines = (revisions: Revisions) => {
  const sideLines = getSideLines(revisions)
  return getTrimmedLines(revisions.merge).filter(line => !sideLines.has(line)).length
}

const truncate = (lines: string[]) => lines.length > MAX_DIFF_LINES
  ? [...lines.slice(0, MAX_DIFF_LINES), `... ${lines.length - MAX_DIFF_LINES} more lines not shown (read the revision files for the rest)`]
  : lines

export const formatDiff = (from: string, to: string) => {
  const lines = splitLines(diffFiles(from, to, 3))
  const start = lines.findIndex(line => line.startsWith('@@'))
  return start === -1 ? '(no differences)' : truncate(lines.slice(start)).join('\n').trimEnd()
}

export const formatConflicts = (output: string) => {
  const lines = splitLines(output)
  const ranges: [number, number][] = []
  let start: number | undefined

  lines.forEach((line, index) => {
    if (CONFLICT_START.test(line)) start = index
    if (start !== undefined && CONFLICT_END.test(line)) {
      ranges.push([Math.max(0, start - CONFLICT_CONTEXT), Math.min(lines.length, index + 1 + CONFLICT_CONTEXT)])
      start = undefined
    }
  })

  return truncate(ranges.flatMap(([from, to], index) => [
    ...(index > 0 ? ['…'] : []),
    ...lines.slice(from, to).map((line, offset) => `${String(from + offset + 1).padStart(6)}  ${line}`)
  ])).join('\n')
}
