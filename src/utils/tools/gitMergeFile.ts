import { writeFile } from "../file.js"
import { runCommand } from "../process.js"
import { DEFAULT_BASE_MARKER_LABEL, DEFAULT_LEFT_MARKER_LABEL, DEFAULT_RIGHT_MARKER_LABEL } from "./index.js"

export const buildGitMergeFileRunner = () => {
  const name = 'git-merge-file'
  const runTool = (leftFile: string, baseFile: string, rightFile: string, mergeFile: string) => {
    const parameters = [
      'merge-file',
      '-L', DEFAULT_LEFT_MARKER_LABEL,
      '-L', DEFAULT_BASE_MARKER_LABEL,
      '-L', DEFAULT_RIGHT_MARKER_LABEL,
      '-p',
      leftFile,
      baseFile,
      rightFile
    ]

    const output = runCommand('git', parameters)
    if (output) writeFile(mergeFile, output)
  }

  return { name, runTool }
}
