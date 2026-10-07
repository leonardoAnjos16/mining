import { runCommand } from './process.js'

export const getMergeCommits = (repoPath, sinceDate, untilDate) => {
  const commandParameters = ['log', '--merges', '--format=%H']
  if (sinceDate) commandParameters.push(`--since=${sinceDate}`)
  if (untilDate) commandParameters.push(`--until=${untilDate}`)

  const logOutput = runCommand('git', commandParameters, { cwd: repoPath })
  return logOutput?.trim()?.split('\n')
}

export const getParentCommits = (repoPath, mergeCommit) => {
  const revListOutput = runCommand('git', ['rev-list', '--parents', '-n', '1', mergeCommit], { cwd: repoPath })

  if (!revListOutput) return

  const [_, ...parents] = revListOutput.trim().split(/\s+/)
  return parents
}

export const getBaseCommit = (repoPath, leftCommit, rightCommit) => {
  return runCommand('git', ['merge-base', leftCommit, rightCommit], { cwd: repoPath })?.trim()
}

export const getModifiedFiles = (repoPath, commit, baseCommit) => {
  const diffOutput = runCommand('git', ['-c', 'diff.renames=false', 'diff', '--name-only', '--diff-filter=M', baseCommit, commit], { cwd: repoPath })

  if (!diffOutput) return []

  const uniqueModifiedFiles = new Set(diffOutput.trim().split('\n').filter(Boolean))
  return [...uniqueModifiedFiles]
}
