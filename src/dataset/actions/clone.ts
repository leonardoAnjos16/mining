import path from 'path'
import { dirExists } from '../../utils/file.js'
import { runCommand } from '../../utils/process.js'
import { getActionOutputPath } from '../index.js'
import { DatasetOptions } from '../index.js'
import { Repo } from '../../index.js'

const name = 'clone'

const runAction = (inputRepos: Repo[], options: DatasetOptions) => {
  const outputPath = getActionOutputPath(name, options)
  inputRepos.forEach(({ name, path }) => {
    runCommand('git', ['clone', path, name], { cwd: outputPath, showOutput: true })
  })
}

const isDone = (inputRepos: Repo[], options: DatasetOptions) => {
  const outputPath = getActionOutputPath(name, options)
  if (!dirExists(outputPath)) return false

  return !inputRepos.some(({ name }) => !dirExists(path.join(outputPath, name)))
}

export const getRepoPath = (repoName: string, options: DatasetOptions) => {
  const outputPath = getActionOutputPath(name, options)
  return path.join(outputPath, repoName)
}

export const CLONE_ACTION = {
  name,
  runAction,
  isDone
}
