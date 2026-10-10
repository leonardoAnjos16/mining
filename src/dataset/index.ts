import path from 'path'
import { parseCSV } from '../utils/csv.js'
import { createDir, removeDir } from '../utils/file.js'
import { CLONE_ACTION } from './actions/clone.js'
import { COMMITS_ACTION } from './actions/commits.js'
import { FILES_ACTION } from './actions/files.js'

export type DatasetOptions = {
  output: string
  since: string
  until: string
  randomSeed: number
  maxCommits: number
  extensions: string[]
}

export type Repo = {
  name: string
  path: string
}

type Action = {
  name: string
  runAction: (inputRepos: Repo[], options: DatasetOptions) => void
  isDone: (inputRepos: Repo[], options: DatasetOptions) => boolean
}

const actions: Action[] = [
  CLONE_ACTION,
  COMMITS_ACTION,
  FILES_ACTION
]

export const getActionOutputPath = (action: string, options: DatasetOptions) => path.resolve(options.output, action)

export const runAction = (action: string, inputFile: string, options: DatasetOptions) => {
  const actionIndex = actions.findIndex(({ name }) => name === action)
  if (actionIndex === -1) {
    throw new Error('Invalid action')
  }

  const inputRepos = parseCSV<Repo>(inputFile)
  for (let i = 0; i <= actionIndex; i++) {
    const { name, runAction, isDone } = actions[i]
    if (i === actionIndex || !isDone(inputRepos, options)) {
      console.log(`Running ${name} action`)

      const actionOutputPath = getActionOutputPath(name, options)
      removeDir(actionOutputPath)
      createDir(actionOutputPath)
      runAction(inputRepos, options)
    }
  }
}

export const getAvailableActions = () => actions.map(({ name }) => name)
