import path from 'path'
import { parseCSV } from '../utils/csv.js'
import { createDir, removeDir } from '../utils/file.js'
import { CLONE_ACTION } from './actions/clone.js'
import { COMMITS_ACTION } from './actions/commits.js'
import { FILES_ACTION } from './actions/files.js'
import { Repo } from '../index.js'
import { getFetchOutputFile, isFetchDone, runFetchAction } from './actions/fetch.js'

export type DatasetOptions = {
  output: string
  since: string
  until: string
  randomSeed: number
  maxRepos: number
  maxCommits: number
  languages: string[]
  extensions: string[]
}

type Action = {
  name: string
  runAction: (repos: Repo[], options: DatasetOptions) => void
  isDone: (repos: Repo[], options: DatasetOptions) => boolean
}

const actions: Action[] = [
  CLONE_ACTION,
  COMMITS_ACTION,
  FILES_ACTION
]

export const getActionOutputPath = (action: string, options: DatasetOptions) => path.resolve(options.output, 'dataset', action)

export const runAction = async (action: string, options: DatasetOptions) => {
  if (action === 'fetch') {
    await runFetchAction(options)
    return
  }

  const actionIndex = actions.findIndex(({ name }) => name === action)
  if (actionIndex === -1) {
    throw new Error('Invalid action')
  }

  if (!isFetchDone(options)) {
    await runFetchAction(options)
  }

  const repos = parseCSV<Repo>(getFetchOutputFile(options))
  for (let i = 0; i <= actionIndex; i++) {
    const { name, runAction, isDone } = actions[i]
    if (i === actionIndex || !isDone(repos, options)) {
      console.log(`Running ${name} action`)

      const actionOutputPath = getActionOutputPath(name, options)
      removeDir(actionOutputPath)
      createDir(actionOutputPath)
      runAction(repos, options)
    }
  }
}

export const getAvailableActions = () => ['fetch', ...actions.map(({ name }) => name)]
