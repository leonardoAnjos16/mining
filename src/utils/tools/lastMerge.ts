import { runCommand } from "../process.js"
import { getToolPath } from "./index.js"

export const buildLastMergeRunner = () => {
  const name = 'last-merge'

  const toolPath = getToolPath('last-merge')
  const runTool = (leftFile: string, baseFile: string, rightFile: string, mergeFile: string) => {
    const parameters = [
      'merge',
      `--left-path=${leftFile}`,
      `--base-path=${baseFile}`,
      `--right-path=${rightFile}`,
      `--merge-path=${mergeFile}`
    ]

    runCommand(toolPath, parameters)
  }

  return { name, runTool }
}
