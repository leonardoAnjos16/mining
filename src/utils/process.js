import { execFileSync } from 'child_process'

export const runCommand = (command, parameters, { cwd, showOutput = false } = {}) => {
  try {
    const options = {
      cwd,
      encoding: 'utf8',
      maxBuffer: 100 * 1024 * 1024 // 100 MB
    }

    if (showOutput) {
      options.stdio = 'inherit'
    }

    return execFileSync(command, parameters, options)
  } catch (error) {
    console.error(`${command} failed: ${error}`)
  }
}
