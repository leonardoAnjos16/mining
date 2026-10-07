import { execFileSync, ExecFileSyncOptions } from 'child_process'

type CommandOptions = {
  cwd?: string
  showOutput?: boolean
}

export const runCommand = (command: string, parameters: string[], { cwd, showOutput = false }: CommandOptions = {}) => {
  try {
    const options: ExecFileSyncOptions = {
      cwd,
      encoding: 'utf8',
      maxBuffer: 100 * 1024 * 1024 // 100 MB
    }

    if (showOutput) {
      options.stdio = 'inherit'
    }

    return execFileSync(command, parameters, options) as string
  } catch (error) {
    console.error(`${command} failed: ${error}`)
  }
}
