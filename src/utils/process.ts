import { spawnSync, SpawnSyncOptions } from 'child_process'
import { formatError } from './log.js'

type CommandOptions = {
  cwd?: string
  showOutput?: boolean
  isSuccess?: (exitCode: number) => boolean
  timeout?: number
}

export class TimeoutError extends Error {
  constructor(command: string, timeout: number) {
    super(`${command} timed out after ${timeout / 1000}s`)
    this.name = 'TimeoutError'
  }
}

const defaultIsSuccess = (exitCode: number) => exitCode === 0

export const runCommand = (
  command: string,
  parameters: string[],
  { cwd, showOutput = false, isSuccess = defaultIsSuccess, timeout }: CommandOptions = {}
) => {
  const options: SpawnSyncOptions = {
    cwd,
    encoding: 'utf8',
    maxBuffer: 100 * 1024 * 1024, // 100 MB
    stdio: showOutput ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    timeout,
    killSignal: 'SIGKILL'
  }

  const result = spawnSync(command, parameters, options)
  if (!result.error && result.status !== null && isSuccess(result.status)) {
    return result.stdout as string
  }

  if (timeout !== undefined && (result.error as NodeJS.ErrnoException | undefined)?.code === 'ETIMEDOUT') {
    throw new TimeoutError(command, timeout)
  }

  console.error(formatError(`${command} failed`, {
    args: parameters.join(' '),
    cwd,
    error: result.error?.message,
    exit: result.error ? undefined : result.status ?? undefined,
    signal: result.signal ?? undefined,
    stderr: (result.stderr as string | null)?.trim() || undefined
  }))
}
