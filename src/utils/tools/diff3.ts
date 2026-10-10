import { writeFile } from "../file.js"
import { runCommand } from "../process.js"
import { DEFAULT_BASE_MARKER_LABEL, DEFAULT_LEFT_MARKER_LABEL, DEFAULT_RIGHT_MARKER_LABEL, getToolPath } from "./index.js"

export const buildDiff3Runner = () => {
  const name = 'diff3'
  const runTool = (leftFile: string, baseFile: string, rightFile: string, mergeFile: string) => {
    const parameters = [
      '-E',
      '-L', DEFAULT_LEFT_MARKER_LABEL,
      '-L', DEFAULT_BASE_MARKER_LABEL,
      '-L', DEFAULT_RIGHT_MARKER_LABEL,
      '-m',
      leftFile,
      baseFile,
      rightFile
    ]

    const output = runCommand('diff3', parameters)
    if (output) writeFile(mergeFile, output)
  }

  return { name, runTool }
}
