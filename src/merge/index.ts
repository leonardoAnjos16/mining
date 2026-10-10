import path from 'path'
import { getBaseCommit, getFileFromCommit, getParentCommits } from "../utils/git.js"
import { getTool } from "../utils/tools/index.js"
import { getExtension, writeFile } from '../utils/file.js'

type MergeOptions = {
  output: string
  alias?: string
}

const writeFileRevision = (projectPath: string, commit: string, filepath: string, outputDir: string, revisionName: string) => {
  const outputPath = path.join(outputDir, `${revisionName}.${getExtension(filepath)}`)

  const content = getFileFromCommit(projectPath, commit, filepath)
  if (!content) {
    throw new Error(`Could not retrieve ${revisionName} revision`)
  }

  writeFile(outputPath, content)

  return outputPath
}

export const runTool = (toolNames: string[], projectPath: string, mergeCommit: string, filepath: string, options: MergeOptions) => {
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
  const baseFile = writeFileRevision(projectPath, baseCommit, filepath, outputDir, 'base')
  const leftFile = writeFileRevision(projectPath, leftCommit, filepath, outputDir, 'left')
  const rightFile = writeFileRevision(projectPath, rightCommit, filepath, outputDir, 'right')

  toolNames.forEach(toolName => {
    const tool = getTool(toolName)
    if (!tool) {
      throw new Error(`Invalid tool: ${toolName}`)
    }

    const { name, runTool } = tool

    const mergeFile = path.join(outputDir, `${name}.${getExtension(filepath)}`)
    runTool(leftFile, baseFile, rightFile, mergeFile)
  })
}
