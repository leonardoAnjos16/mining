import { runCommand } from "../process.js"
import { getToolPath } from "./index.js"

type Options = {
  extensive?: boolean
  granularityThreshold?: number
}

export const buildSepMergeCPPRunner = ({ extensive, granularityThreshold }: Options = {}) => {
  let name = 'sepmergecpp'
  if (extensive) {
    name += '-extensive'
  }

  if (granularityThreshold !== undefined) {
    name += `-gt${granularityThreshold}`
  }

  const toolPath = getToolPath('sepmergecpp')
  const runTool = (leftFile: string, baseFile: string, rightFile: string, mergeFile: string) => {
    const parameters = [
      leftFile,
      baseFile,
      rightFile,
      '-o', mergeFile
    ]

    if (extensive) {
      parameters.push('-e')
    }

    if (granularityThreshold !== undefined) {
      parameters.push('-g', granularityThreshold.toString())
    }

    runCommand(`${toolPath}`, parameters)
  }

  return { name, runTool }
}
