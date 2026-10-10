import path from 'path'
import { getBaseCommit, getFileFromCommit, getParentCommits } from "./utils/git.js"
import { getTool } from "./utils/tools/index.js"
import { getExtension, writeFile } from './utils/file.js'

type MergeOptions = {
  output: string
  alias?: string
}

export const createFileRevision = (projectPath: string, commit: string, filepath: string, outputDir: string, revisionName: string) => {
  const outputPath = path.join(outputDir, `${revisionName}.${getExtension(filepath)}`)

  const content = getFileFromCommit(projectPath, commit, filepath)
  if (!content) {
    throw new Error(`Could not retrieve ${revisionName} revision`)
  }

  writeFile(outputPath, content)

  return outputPath
}

export const runTools = (
  toolNames: string[],
  projectPath: string,
  baseCommit: string,
  leftCommit: string,
  rightCommit: string,
  filepath: string,
  outputDir: string
) => {
  const baseFile = createFileRevision(projectPath, baseCommit, filepath, outputDir, 'base')
  const leftFile = createFileRevision(projectPath, leftCommit, filepath, outputDir, 'left')
  const rightFile = createFileRevision(projectPath, rightCommit, filepath, outputDir, 'right')
  
  toolNames.forEach(toolName => {
    const tool = getTool(toolName)
    if (!tool) {
      console.error(`Invalid tool: ${toolName}`)
      return
    }
  
    const { name, runTool } = tool
  
    const mergeFile = path.join(outputDir, `${name}.${getExtension(filepath)}`)
    runTool(leftFile, baseFile, rightFile, mergeFile)
  })
}

export const runMerge = (toolNames: string[], projectPath: string, mergeCommit: string, filepath: string, options: MergeOptions) => {
  const parentCommits = getParentCommits(projectPath, mergeCommit)
  if (!parentCommits || parentCommits.length !== 2) {
    throw new Error('Could not retrieve left and right commits')
  }

  const [leftCommit, rightCommit] = parentCommits

  const baseCommit = getBaseCommit(projectPath, leftCommit, rightCommit)
  if (!baseCommit) {
    throw new Error('Could not retrieve base commit')
  }

  const outputDir = path.resolve(options.output, 'merge', mergeCommit, options.alias ?? filepath)
  runTools(toolNames, projectPath, baseCommit, leftCommit, rightCommit, filepath, outputDir)
}
