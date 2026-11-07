/**
 * Formats a title followed by aligned "label: value" lines. Undefined values are skipped,
 * and multi-line values stay aligned under their first line:
 *
 *   git failed
 *     args:   show HEAD:nope
 *     exit:   128
 *     stderr: first line
 *             second line
 */
export const formatError = (title: string, fields: Record<string, string | number | undefined>) => {
  const entries = Object.entries(fields).filter(([_, value]) => value !== undefined)

  const labelWidth = Math.max(...entries.map(([label]) => label.length)) + 1 // +1 for ':'
  const prefixWidth = 2 + labelWidth + 1 // indent + label + space
  const continuationIndent = ' '.repeat(prefixWidth)

  const lines = entries.map(([label, value]) => {
    const paddedLabel = `${label}:`.padEnd(labelWidth)
    const alignedValue = String(value).replace(/\n/g, `\n${continuationIndent}`)

    return `  ${paddedLabel} ${alignedValue}`
  })

  return [title, ...lines].join('\n')
}

// Formats a duration as e.g. "45s", "12m05s" or "1h05m"
export const formatDuration = (ms: number) => {
  const totalSeconds = Math.round(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const pad = (value: number) => value.toString().padStart(2, '0')
  if (hours > 0) return `${hours}h${pad(minutes)}m`
  if (minutes > 0) return `${minutes}m${pad(seconds)}s`
  return `${seconds}s`
}
