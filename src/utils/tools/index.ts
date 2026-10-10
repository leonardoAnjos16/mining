import path from 'path'
import { buildSepMergeCPPRunner } from './sepmergecpp.js'

type MergeTool = {
  name: string
  runTool: (leftFile: string, baseFile: string, rightFile: string, mergeFile: string) => void
}

export const getTool = (tool: string) => tools.find(({ name }) => name === tool)

export const getToolPath = (tool: string) => path.resolve('tools', tool)

export const getAvailableTools = () => tools.map(({ name }) => name)

const tools: MergeTool[] = [
  buildSepMergeCPPRunner(),
  buildSepMergeCPPRunner({ extensive: true }),
  buildSepMergeCPPRunner({ granularityThreshold: 0 }),
  buildSepMergeCPPRunner({ granularityThreshold: 1 }),
  buildSepMergeCPPRunner({ granularityThreshold: 5 }),
  buildSepMergeCPPRunner({ extensive: true, granularityThreshold: 0 }),
  buildSepMergeCPPRunner({ extensive: true, granularityThreshold: 1 }),
  buildSepMergeCPPRunner({ extensive: true, granularityThreshold: 5 })
]
