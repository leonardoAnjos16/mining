import path from 'path'
import { getActionOutputPath, Repo } from '../index.js'
import { createCSV } from '../../utils/csv.js'
import { dirExists, fileExists } from '../../utils/file.js'
import { getMergeCommits } from '../../utils/git.js'
import { getRepoPath } from './clone.js'
import { DatasetOptions } from '../../index.js'

const name = 'commits'

const runAction = (inputRepos: Repo[], options: DatasetOptions) => {
  const outputPath = getActionOutputPath(name, options)
  inputRepos.forEach(({ name }) => {
    const repoPath = getRepoPath(name, options)
    const mergeCommits = getMergeCommits(repoPath, options.since, options.until)?.map(commit => ({ commit })) ?? []

    const filepath = path.join(outputPath, `${name}.csv`)
    createCSV(filepath, ['commit'], mergeCommits)

    console.log(`Found ${mergeCommits.length} candidate merge commits for project ${name}`)
  })
}

const isDone = (inputRepos: Repo[], options: DatasetOptions) => {
  const outputPath = getActionOutputPath(name, options)
  if (!dirExists(outputPath)) return false

  return !inputRepos.some(({ name }) => !fileExists(path.join(outputPath, `${name}.csv`)))
}

export const COMMITS_ACTION = {
  name,
  runAction,
  isDone
}
