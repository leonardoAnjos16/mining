import type { Metric, ToolState } from '../../analysis/cases/types'

export const SUBSETS: Record<string, string> = {
  'all': 'All',
  'different-sides': 'Different sides',
  'same-sides': 'Same sides (left = right)'
}

export const TABS: Record<string, string> = { dataset: 'Dataset', tools: 'Tools', pairs: 'Pairs', time: 'Time', cases: 'Cases' }

export const TOOL_COLUMNS: Record<string, string> = {
  'scenarios': 'Merge commits in this scope.',
  'files': 'Files in this scope.',
  'failures': 'Files where the tool failed (no output or timeout). Percentage of all files.',
  'timeouts': 'Files where the tool was killed after the timeout.',
  'conflicts': 'Conflict markers in the output.',
  'scenarios with conflict': 'Merge commits with at least one conflicting file. Percentage of merge commits with at least one file where every tool succeeded.',
  'files with conflict': 'Files with at least one conflict. Percentage of files where every tool succeeded.'
}

export const CORRECTNESS_COLUMNS: Record<string, string> = {
  'with conflict': 'The tool reported at least one conflict.',
  'clean and equal to merge': 'No conflicts, and equal to the merge commit.',
  'clean and different from merge': 'No conflicts, but different from the merge commit: possibly a missed conflict.'
}

export const PAIR_METRICS: Record<string, { base?: string, description: string }> = {
  'agreements': { base: 'compared', description: 'Both tools produced exactly the same output.' },
  'normalized-agreements': { base: 'compared', description: 'Both tools produced the same output, ignoring whitespace.' },
  'afp': { base: 'conflict-disagreements', description: 'Additional false positive: the row tool reports a conflict, while the column tool merges cleanly and matches the merge commit.' },
  'afn': { base: 'conflict-disagreements', description: 'Additional false negative: the row tool merges cleanly but differs from the merge commit, while the column tool reports a conflict.' },
  'compared': { description: 'Files where every tool succeeded. Base for agreement percentages.' },
  'conflict-disagreements': { description: 'Files where exactly one of the two tools reports a conflict. Base for AFP and AFN percentages.' }
}

export const TIME_PLOTS: Record<string, string> = {
  'trimmed': 'Mean without the fastest and slowest runs',
  'without-first': 'Mean without the first run',
  'all': 'Mean of all runs'
}

export const CASE_METRICS: Record<Metric, { name: string, description: (tool: string, otherTool?: string) => string }> = {
  'afp': { name: 'AFP', description: (tool, otherTool) => `${tool} reports a conflict, while ${otherTool} merges cleanly and matches the merge commit. Outcome labels explain why a case is in this group.` },
  'afn': { name: 'AFN', description: (tool, otherTool) => `${tool} merges cleanly but differs from the merge commit, while ${otherTool} reports a conflict. Outcome labels explain why a case is in this group.` },
  'clean-different': { name: 'Clean mismatch', description: tool => `${tool} merges cleanly, but its output doesn't match the merge commit, ignoring whitespace. Outcome labels explain why a case is in this group.` }
}

export const OVERVIEW_DESCRIPTIONS: Record<Metric, (tool: string) => string> = {
  'afp': tool => tool
    ? `${tool} reported a conflict, while the column's tool merged cleanly and matched the merge commit.`
    : 'Each column is the tool that reported a conflict, while another tool merged cleanly and matched the merge commit.',
  'afn': tool => tool
    ? `${tool} merged cleanly but differs from the merge commit, while the column's tool reported a conflict.`
    : 'Each column is the tool that merged cleanly but differs from the merge commit, while another tool reported a conflict.',
  'clean-different': () => `Each column is a tool that merged cleanly, but whose output doesn't match the merge commit.`
}

export const STATES: Record<ToolState, string> = {
  'conflict': 'conflict',
  'clean-equal': 'clean, equal to merge',
  'clean-different': 'clean, different from merge',
  'failed': 'failed'
}

export const LABEL_KINDS = {
  'outcome': { title: 'Outcome labels', description: 'Why a case is in a group: one or more per case and group, main reason first.', appliesName: (value: string) => CASE_METRICS[value as Metric]?.name ?? value },
  'behavior': { title: 'Behaviour labels', description: 'Why a tool produced its output: one or more per tool in a case.', appliesName: (value: string) => STATES[value as ToolState] ?? value }
} as const
