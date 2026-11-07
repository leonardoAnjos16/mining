import { runCommand } from "../process.js"
import { getToolPath, TOOL_TIMEOUT_MS } from "./index.js"

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

    runCommand(toolPath, parameters, {
      timeout: TOOL_TIMEOUT_MS,
      isSuccess: code => code === 0 || code === 1 // 1 = conflicts
    })
  }

  return { name, runTool }
}
