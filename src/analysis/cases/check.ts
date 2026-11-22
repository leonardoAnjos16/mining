import { collectCases, getCaseErrors } from './annotations.js'
import { getAnalysisDir, getAnnotationsDir } from './paths.js'
import { CaseStatus, CaseSummary } from './types.js'

type CheckOptions = {
  output: string
  group?: string
}

const STATUSES: CaseStatus[] = ['annotated', 'pending', 'stale', 'invalid', 'not-reproduced']

const isToAnnotate = ({ status }: CaseSummary) => status === 'pending' || status === 'stale'

export const checkCases = (alias: string, options: CheckOptions) => {
  const data = collectCases(getAnalysisDir(options.output, alias), getAnnotationsDir(options.output))

  const errors = getCaseErrors(data)
  if (errors.length > 0) {
    console.error(`Invalid labels or annotations:\n${errors.map(error => `  ${error}`).join('\n')}`)
    process.exitCode = 1
  }

  const summaries = Object.values(data.cases)
  console.log(`${summaries.length} cases: ${STATUSES.map(status => `${summaries.filter(info => info.status === status).length} ${status}`).join(', ')}`)

  let toAnnotate = summaries.filter(isToAnnotate)
  if (options.group) {
    const group = data.groups.find(({ id }) => id === options.group)
    if (!group) {
      console.error(`Unknown group ${options.group}. Groups: ${data.groups.map(({ id }) => id).join(', ')}`)
      process.exitCode = 1
      return
    }

    toAnnotate = group.cases.map(id => data.cases[id]).filter(info => info && isToAnnotate(info))
    console.log(`Group ${group.id}: ${toAnnotate.length} of ${group.cases.length} selected cases to annotate, in selection order`)
  }

  toAnnotate.forEach(({ id, status, project, filepath, focus, groups }) =>
    console.log(`${status} ${id} ${project} ${filepath} (tools: ${focus.join(', ')}; groups: ${groups.join(', ')})`))
}
