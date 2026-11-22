import hljs from 'highlight.js/lib/core'
import go from 'highlight.js/lib/languages/go'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import rust from 'highlight.js/lib/languages/rust'

hljs.registerLanguage('go', go)
hljs.registerLanguage('java', java)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('rust', rust)

const MARKER = /^(<{7}|\|{7}|={7}|>{7})( |\r?$)/

const splitHighlighted = (html: string) => {
  const lines = ['']
  const open: string[] = []
  html.split(/(<span[^>]*>|<\/span>|\n)/).forEach(part => {
    if (part === '\n') {
      lines[lines.length - 1] += '</span>'.repeat(open.length)
      lines.push(open.join(''))
    } else {
      if (part.startsWith('<span')) open.push(part)
      else if (part === '</span>') open.pop()
      lines[lines.length - 1] += part
    }
  })
  return lines
}

export const highlightLines = (lines: (string | null)[], language: string): (string | null)[] => {
  if (!hljs.getLanguage(language)) return lines.map(() => null)

  const result: (string | null)[] = lines.map(() => null)
  let run: number[] = []
  const flush = () => {
    if (run.length === 0) return
    const html = hljs.highlight(run.map(index => lines[index]).join('\n'), { language, ignoreIllegals: true }).value
    splitHighlighted(html).forEach((line, offset) => { result[run[offset]] = line })
    run = []
  }

  lines.forEach((line, index) => {
    if (line === null || MARKER.test(line)) flush()
    else run.push(index)
  })
  flush()

  return result
}
