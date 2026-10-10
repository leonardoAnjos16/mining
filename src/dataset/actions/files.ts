import path from 'path'
import { COMMITS_ACTION } from "./commits.js"
import { getActionOutputPath } from "../index.js"
import { createCSV, parseCSV } from '../../utils/csv.js'
import { shuffle } from '../../utils/random.js'
import { getBaseCommit, getModifiedFiles, getParentCommits } from '../../utils/git.js'
import { dirExists, fileExists } from '../../utils/file.js'
import { getRepoPath } from './clone.js'
import { DatasetOptions } from '../index.js'
import { MergeScenarioFile, Repo } from '../../index.js'

const name = 'files'

const isRelevantFile = (filepath: string, options: DatasetOptions) => {
  if (filepath.startsWith('vendor/')) return false
  if (!options.extensions.some(extension => filepath.endsWith(extension))) return false

  return true
}

const runAction = (inputRepos: Repo[], options: DatasetOptions) => {
  const outputPath = getActionOutputPath(name, options)
  inputRepos.forEach(({ name }) => {
    const commitsActionOutputPath = getActionOutputPath(COMMITS_ACTION.name, options)
    const commitsFilePath = path.join(commitsActionOutputPath, `${name}.csv`)

    let commits = parseCSV<{ commit: string }>(commitsFilePath).map(({ commit }) => commit)
    if (options.randomSeed !== undefined) {
      commits = shuffle(commits, options.randomSeed)
    }
    
    const files: MergeScenarioFile[] = []
    let commitsCount = 0
    
    const repoPath = getRepoPath(name, options)
    for (let i = 0; i < commits.length && commitsCount < options.maxCommits; i++) {
      const mergeCommit = commits[i]
      const parents = getParentCommits(repoPath, mergeCommit)

      if (!parents || parents.length !== 2) continue

      const [leftCommit, rightCommit] = parents
      const baseCommit = getBaseCommit(repoPath, leftCommit, rightCommit)

      if (!baseCommit) continue

      const leftModifiedFiles = getModifiedFiles(repoPath, leftCommit, baseCommit)
      const rightModifiedFiles = new Set(getModifiedFiles(repoPath, rightCommit, baseCommit))

      const commonModifiedFiles = leftModifiedFiles.filter(file => rightModifiedFiles.has(file))
      const relevantFiles = commonModifiedFiles.filter(filepath => isRelevantFile(filepath, options))

      if (relevantFiles.length > 0) {
        commitsCount++
        relevantFiles.forEach(filepath => {
          files.push({
            baseCommit,
            leftCommit,
            rightCommit,
            mergeCommit,
            filepath
          })
        })
      }
    }

    const filepath = path.join(outputPath, `${name}.csv`)
    const headers = ['baseCommit', 'leftCommit', 'rightCommit', 'mergeCommit', 'filepath'] as const
    createCSV(filepath, headers, files)

    console.log(`Found ${commitsCount} fitting merge commits with ${files.length} fitting files for project ${name}`)
  })
}

const isDone = (inputRepos: Repo[], options: DatasetOptions) => {
  const outputPath = getActionOutputPath(name, options)
  if (!dirExists(outputPath)) return false

  return !inputRepos.some(({ name }) => !fileExists(path.join(outputPath, `${name}.csv`)))
}

export const FILES_ACTION = {
  name,
  runAction,
  isDone
}
