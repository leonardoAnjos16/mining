export type ToolState = 'conflict' | 'clean-equal' | 'clean-different' | 'failed'

export const BEHAVIOR_STATES = ['conflict', 'clean-equal', 'clean-different'] as const
export const OUTCOME_METRICS = ['afp', 'afn', 'clean-different'] as const

export type Metric = (typeof OUTCOME_METRICS)[number]

export type Label = {
  id: string
  kind: 'behavior' | 'outcome'
  appliesTo: string[]
  name: string
  rule: string
  example?: string
}

export type ConflictBlock = {
  startLine: number
  sidesEqualIgnoringWhitespace: boolean
}

export type ToolFacts = {
  state: ToolState
  conflicts: number
  conflictBlocks: ConflictBlock[]
  missingLines: number
  extraLines: number
  missingMergeOnlyLines: number
  sameLinesDifferentOrder: boolean
  missingExamples: string[]
  extraExamples: string[]
}

export type CaseGroup = {
  id: string
  metric: Metric
  tool: string
  otherTool?: string
  total: number
  cases: string[]
}

export type Hashes = {
  base: string
  left: string
  right: string
  merge: string
  tools: Record<string, string | null>
}

export type CaseInfo = {
  id: string
  key: string
  project: string
  mergeCommit: string
  filepath: string
  language: string
  commits: { base: string, left: string, right: string, merge: string }
  files: Record<string, string>
  groups: string[]
  focus: string[]
  reproduced: boolean
  mismatches: string[]
  mergeOnlyLines: number
  hashes: Hashes
  tools: Record<string, ToolFacts & { recordedState: ToolState }>
}

export type Annotation = {
  key: string
  hashes: Hashes
  summary: { left: string, right: string, merge: string }
  tools: Record<string, { labels: string[], note: string }>
  groups: Record<string, { label: string, note: string }>
  annotator: string
  date: string
  reviewed?: boolean
}

export type Selection = {
  resultsPath: string
  projectsPath: string
  perGroup: number
  seed: number
  groups: CaseGroup[]
}

export type CaseStatus = 'annotated' | 'pending' | 'stale' | 'invalid' | 'not-reproduced'

export type CaseSummary = CaseInfo & {
  status: CaseStatus
  annotation: Annotation | null
  errors: string[]
}

export type CasesData = {
  labels: Label[]
  labelErrors: string[]
  groups: CaseGroup[]
  cases: Record<string, CaseSummary>
  annotationsPath: string
}

export type Change = 'same' | 'changed' | 'both'

export type AlignedCell = [number, string, Change] | null

export type AlignedRow = [AlignedCell, AlignedCell, AlignedCell] | ['gap', number]

export type CaseData = {
  aligned: AlignedRow[]
  merge: AlignedRow[]
  outputs: Record<string, AlignedRow[]>
}

export type Table = {
  headers: string[]
  rows: (string | number)[][]
}

export type AnalysisData = {
  tables: Record<string, Table>
}
