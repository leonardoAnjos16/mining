import path from 'path'
import { fileExists, readJSON } from '../../utils/file.js'
import { loadLabels } from './labels.js'
import { getAnnotationPath, getCaseDir, getSelectionPath } from './paths.js'
import { Annotation, BEHAVIOR_STATES, CaseInfo, CasesData, CaseStatus, CaseSummary, Label, OUTCOME_METRICS, Selection } from './types.js'

const LABEL_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/

const isText = (value: unknown) => typeof value === 'string' && value.trim() !== ''

const validateLabels = (labels: Label[]) => {
  const errors: string[] = []
  const ids = new Set<string>()

  labels.forEach((label, index) => {
    const where = `label ${index + 1}${label.id ? ` (${label.id})` : ''}`
    if (!LABEL_ID.test(label.id ?? '')) errors.push(`${where}: id must be lowercase words joined by hyphens`)
    if (ids.has(label.id)) errors.push(`${where}: duplicate id`)
    ids.add(label.id)

    const allowed: readonly string[] = label.kind === 'behavior' ? BEHAVIOR_STATES : label.kind === 'outcome' ? OUTCOME_METRICS : []
    if (allowed.length === 0) errors.push(`${where}: kind must be "behavior" or "outcome"`)
    else if (!Array.isArray(label.appliesTo) || label.appliesTo.length === 0 || label.appliesTo.some(value => !allowed.includes(value))) {
      errors.push(`${where}: appliesTo must list some of ${allowed.join(', ')}`)
    }

    if (!isText(label.name)) errors.push(`${where}: name is missing`)
    if (!isText(label.rule)) errors.push(`${where}: rule is missing`)
  })

  return errors
}

const validateAnnotation = (info: CaseInfo, annotation: Annotation, labels: Label[]) => {
  const errors: string[] = []
  if (annotation.key !== info.key) errors.push(`key is ${JSON.stringify(annotation.key)}, expected ${JSON.stringify(info.key)}`)

  ;(['left', 'right', 'merge'] as const).forEach(side => {
    if (!isText(annotation.summary?.[side])) errors.push(`summary.${side} is missing`)
  })

  if (!isText(annotation.annotator)) errors.push('annotator is missing')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(annotation.date ?? '')) errors.push('date must be YYYY-MM-DD')
  if (annotation.reviewed !== undefined && typeof annotation.reviewed !== 'boolean') errors.push('reviewed must be true or false')

  const checkLabel = (id: string, kind: Label['kind'], appliesTo: string, where: string) => {
    const label = labels.find(candidate => candidate.id === id)
    if (!label) errors.push(`${where}: unknown label ${JSON.stringify(id)}`)
    else if (label.kind !== kind) errors.push(`${where}: label ${id} is a ${label.kind} label, expected a ${kind} label`)
    else if (!label.appliesTo.includes(appliesTo)) errors.push(`${where}: label ${id} applies to ${label.appliesTo.join(', ')}, not ${appliesTo}`)
  }

  Object.entries(annotation.tools ?? {}).forEach(([tool, { labels: toolLabels, note }]) => {
    const facts = info.tools[tool]
    if (!facts) return errors.push(`tools.${tool} is not a tool of this case`)
    if (!isText(note)) errors.push(`tools.${tool}.note is missing`)
    if (!Array.isArray(toolLabels) || toolLabels.length === 0) return errors.push(`tools.${tool}.labels is empty`)
    toolLabels.forEach(id => checkLabel(id, 'behavior', facts.state, `tools.${tool}`))
    if (new Set(toolLabels).size !== toolLabels.length) errors.push(`tools.${tool}.labels has duplicates`)
  })

  Object.entries(annotation.groups ?? {}).forEach(([group, { labels: groupLabels, note }]) => {
    if (!info.groups.includes(group)) return errors.push(`groups.${group} is not a group of this case`)
    if (!isText(note)) errors.push(`groups.${group}.note is missing`)
    if (!Array.isArray(groupLabels) || groupLabels.length === 0) return errors.push(`groups.${group}.labels is empty`)
    groupLabels.forEach(id => checkLabel(id, 'outcome', group.split('/')[0], `groups.${group}`))
    if (new Set(groupLabels).size !== groupLabels.length) errors.push(`groups.${group}.labels has duplicates`)
  })

  return errors
}

const sameHashes = (info: CaseInfo, annotation: Annotation) =>
  (['base', 'left', 'right', 'merge'] as const).every(revision => annotation.hashes?.[revision] === info.hashes[revision]) &&
  Object.keys(annotation.tools ?? {}).every(tool => annotation.hashes?.tools?.[tool] === info.hashes.tools[tool])

const isComplete = (info: CaseInfo, annotation: Annotation) =>
  info.focus.every(tool => annotation.tools?.[tool]) && info.groups.every(group => annotation.groups?.[group])

const getStatus = (info: CaseInfo, annotation: Annotation | undefined, errors: string[]): CaseStatus => {
  if (!info.reproduced) return 'not-reproduced'
  if (errors.length > 0) return 'invalid'
  if (!annotation) return 'pending'
  if (!sameHashes(info, annotation)) return 'stale'
  return isComplete(info, annotation) ? 'annotated' : 'pending'
}

const readAnnotation = (info: CaseInfo, annotationPath: string, labels: Label[]) => {
  if (!fileExists(annotationPath)) return { annotation: undefined, errors: [] }
  try {
    const annotation = readJSON<Annotation>(annotationPath)
    return { annotation, errors: validateAnnotation(info, annotation, labels) }
  } catch (error) {
    return { annotation: undefined, errors: [String(error)] }
  }
}

const getDisplayPath = (directory: string) => {
  const relative = path.relative(process.cwd(), directory)
  return relative.startsWith('..') || path.isAbsolute(relative) ? directory : relative
}

export const hasCases = (analysisDir: string) => fileExists(getSelectionPath(analysisDir))

export const collectCases = (analysisDir: string, annotationsDir: string, labels: Label[] = loadLabels()): CasesData => {
  if (!hasCases(analysisDir)) throw new Error(`Missing ${getSelectionPath(analysisDir)}: run "analysis cases" first`)

  const selection = readJSON<Selection>(getSelectionPath(analysisDir))
  const ids = Array.from(new Set(selection.groups.flatMap(({ cases }) => cases))).sort()

  const cases = Object.fromEntries(ids.map(id => {
    const info = readJSON<CaseInfo>(path.join(getCaseDir(analysisDir, id), 'case.json'))
    const { annotation, errors } = readAnnotation(info, getAnnotationPath(annotationsDir, id), labels)
    const status = getStatus(info, annotation, errors)
    const summary: CaseSummary = { ...info, status, annotation: status === 'annotated' ? annotation! : null, errors }
    return [id, summary]
  }))

  return {
    labels,
    labelErrors: validateLabels(labels),
    groups: selection.groups,
    cases,
    annotationsPath: getDisplayPath(annotationsDir)
  }
}

export const getCaseErrors = ({ labelErrors, cases, annotationsPath }: CasesData) => [
  ...labelErrors.map(error => `labels: ${error}`),
  ...Object.values(cases).flatMap(({ id, errors }) => errors.map(error => `${path.join(annotationsPath, `${id}.json`)}: ${error}`))
]
