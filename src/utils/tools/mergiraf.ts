import { runCommand } from "../process.js"
import { DEFAULT_BASE_MARKER_LABEL, DEFAULT_LEFT_MARKER_LABEL, DEFAULT_RIGHT_MARKER_LABEL, getToolPath, TOOL_TIMEOUT_MS } from "./index.js"

export const buildMergirafRunner = () => {
  const name = 'mergiraf'

  const toolPath = getToolPath('mergiraf')
  const runTool = (leftFile: string, baseFile: string, rightFile: string, mergeFile: string) => {
    const parameters = [
      'merge',
      '-s', DEFAULT_BASE_MARKER_LABEL,
      '-x', DEFAULT_LEFT_MARKER_LABEL,
      '-y', DEFAULT_RIGHT_MARKER_LABEL,
      baseFile,
      leftFile,
      rightFile,
      '-o', mergeFile
    ]

    runCommand(toolPath, parameters, {
      timeout: TOOL_TIMEOUT_MS,
      isSuccess: code => code === 0 || code === 1 // 1 = conflicts
    })
  }

  return { name, runTool }
}
