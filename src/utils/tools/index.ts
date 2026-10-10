import path from 'path'
import { buildSepMergeCPPRunner } from './sepmergecpp.js'
import { buildDiff3Runner } from './diff3.js'
import { buildGitMergeFileRunner } from './gitMergeFile.js'
import { buildMergirafRunner } from './mergiraf.js'
import { buildLastMergeRunner } from './lastMerge.js'

type MergeTool = {
  name: string
  runTool: (leftFile: string, baseFile: string, rightFile: string, mergeFile: string) => void
}

export const DEFAULT_LEFT_MARKER_LABEL = 'MINE'
export const DEFAULT_BASE_MARKER_LABEL = 'BASE'
export const DEFAULT_RIGHT_MARKER_LABEL = 'YOURS'

export const getTool = (tool: string) => tools.find(({ name }) => name === tool)

export const getToolPath = (tool: string) => path.resolve('tools', tool)

export const getAvailableTools = () => tools.map(({ name }) => name)

const tools: MergeTool[] = [
  buildDiff3Runner(),
  buildGitMergeFileRunner(),
  buildSepMergeCPPRunner(),
  buildSepMergeCPPRunner({ extensive: true }),
  buildSepMergeCPPRunner({ granularityThreshold: 0 }),
  buildSepMergeCPPRunner({ granularityThreshold: 1 }),
  buildSepMergeCPPRunner({ granularityThreshold: 5 }),
  buildSepMergeCPPRunner({ extensive: true, granularityThreshold: 0 }),
  buildSepMergeCPPRunner({ extensive: true, granularityThreshold: 1 }),
  buildSepMergeCPPRunner({ extensive: true, granularityThreshold: 5 }),
  buildMergirafRunner(),
  buildLastMergeRunner()
]
