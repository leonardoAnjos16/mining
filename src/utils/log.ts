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
