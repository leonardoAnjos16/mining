import path from 'path'
import { fileExists, getExtension, readFile, readJSON, removeDir, writeFile, writeJSON } from '../../utils/file.js'
import { getBaseCommit, getParentCommits } from '../../utils/git.js'
import { createFileRevision, runTools } from '../../merge.js'
import { getScenarioKey, loadScenarios, Scenario } from '../load.js'
import { alignSides } from './align.js'
import { checkCases } from './check.js'
import { countMergeOnlyLines, formatConflicts, formatDiff, getToolFacts, hash, Revisions } from './facts.js'
import { getAnalysisDir, getCaseDir, getSelectionPath } from './paths.js'
import { getCaseId, getRecordedState, selectCases } from './select.js'
import { CaseData, CaseInfo, Selection } from './types.js'

type CasesOptions = {
  output: string
  alias: string
  perGroup: number
  seed: number
}

type Commits = CaseInfo['commits']

const REVISIONS = ['base', 'left', 'right', 'merge'] as const

const getCommits = (projectPath: string, mergeCommit: string): Commits => {
  const parents = getParentCommits(projectPath, mergeCommit)
  if (!parents || parents.length !== 2) throw new Error(`Could not retrieve left and right commits of ${mergeCommit}`)

  const [left, right] = parents
  const base = getBaseCommit(projectPath, left, right)
  if (!base) throw new Error(`Could not retrieve base commit of ${mergeCommit}`)

  return { base, left, right, merge: mergeCommit }
}

const runCaseTools = (scenario: Scenario, tools: string[], projectsPath: string, caseDir: string) => {
  const projectPath = path.resolve(projectsPath, scenario.project)
  const commits = getCommits(projectPath, scenario.mergeCommit)

  createFileRevision(projectPath, scenario.mergeCommit, scenario.filepath, caseDir, 'merge')
  runTools(tools, projectPath, commits.base, commits.left, commits.right, scenario.filepath, caseDir)

  return commits
}

const getPairs = (tools: string[]) => tools.flatMap((tool, index) => tools.slice(index + 1).map(otherTool => [tool, otherTool]))

const writeCaseText = (caseDir: string, scenario: Scenario, files: Record<string, string>, outputs: Record<string, string>) => {
  const section = (title: string, text: string) => `===== ${title} =====\n${text}\n`
  const header = [
    `key: ${getScenarioKey(scenario)}`,
    `language: ${scenario.language}`,
    `files: ${Object.values(files).map(file => path.basename(file)).join(', ')}`
  ].join('\n')

  writeFile(path.join(caseDir, 'case.txt'), [
    `${header}\n`,
    section('diff base -> left', formatDiff(files.base, files.left)),
    section('diff base -> right', formatDiff(files.base, files.right)),
    section('diff base -> merge', formatDiff(files.base, files.merge)),
    ...Object.entries(outputs).flatMap(([tool, output]) => {
      const conflicts = formatConflicts(output)
      return [
        ...(conflicts ? [section(`${tool}: conflict blocks (line numbers of the output)`, conflicts)] : []),
        section(`${tool}: diff merge commit -> output`, formatDiff(files.merge, files[tool]))
      ]
    })
  ].join('\n'))
}

const writeCaseData = (caseDir: string, files: Record<string, string>, tools: string[]) => {
  const data: CaseData = {
    aligned: alignSides({ base: files.base, left: files.left, right: files.right }),
    merge: alignSides({ base: files.base, left: files.merge, right: files.merge }),
    outputs: Object.fromEntries(getPairs(tools).map(([tool, otherTool]) => [
      `${tool}|${otherTool}`,
      alignSides({ base: files.merge, left: files[tool], right: files[otherTool] })
    ]))
  }
  writeFile(path.join(caseDir, 'data.json'), JSON.stringify(data))
}

const describeCase = (scenario: Scenario, tools: string[], caseDir: string, commits: Commits): Omit<CaseInfo, 'groups' | 'focus'> => {
  const extension = getExtension(scenario.filepath)
  const files: Record<string, string> = Object.fromEntries([...REVISIONS, ...tools]
    .map(name => [name, path.join(caseDir, `${name}.${extension}`)])
    .filter(([, file]) => fileExists(file)))

  const revisions = Object.fromEntries(REVISIONS.map(name => [name, readFile(files[name])])) as Revisions
  const outputs = Object.fromEntries(tools.filter(tool => files[tool]).map(tool => [tool, readFile(files[tool])]))

  const toolFacts = Object.fromEntries(tools.map(tool => [tool, {
    ...getToolFacts(outputs[tool], revisions),
    recordedState: getRecordedState(scenario.tools[tool])
  }]))
  const mismatches = tools.filter(tool => toolFacts[tool].state !== toolFacts[tool].recordedState || toolFacts[tool].conflicts !== scenario.tools[tool].conflicts)

  writeCaseText(caseDir, scenario, files, outputs)
  writeCaseData(caseDir, files, Object.keys(outputs))

  return {
    id: path.basename(caseDir),
    key: getScenarioKey(scenario),
    project: scenario.project,
    mergeCommit: scenario.mergeCommit,
    filepath: scenario.filepath,
    language: scenario.language,
    commits,
    files: Object.fromEntries(Object.entries(files).map(([name, file]) => [name, path.basename(file)])),
    reproduced: mismatches.length === 0,
    mismatches,
    mergeOnlyLines: countMergeOnlyLines(revisions),
    hashes: {
      base: hash(revisions.base),
      left: hash(revisions.left),
      right: hash(revisions.right),
      merge: hash(revisions.merge),
      tools: Object.fromEntries(tools.map(tool => [tool, outputs[tool] === undefined ? null : hash(outputs[tool])]))
    },
    tools: toolFacts
  }
}

const groupSelectedCases = (selections: ReturnType<typeof selectCases>) => {
  const selected = new Map<string, { scenario: Scenario, groups: string[], focus: Set<string> }>()

  selections.forEach(({ group, selected: groupScenarios }) => groupScenarios.forEach(scenario => {
    const id = getCaseId(scenario)
    const entry = selected.get(id) ?? { scenario, groups: [], focus: new Set<string>() }
    entry.groups.push(group.id)
    entry.focus.add(group.tool)
    if (group.otherTool) entry.focus.add(group.otherTool)
    selected.set(id, entry)
  }))

  return selected
}

export const runCases = (resultsPath: string, projectsPath: string, options: CasesOptions) => {
  const scenarios = loadScenarios(resultsPath)
  const tools = [...new Set(scenarios.flatMap(({ tools }) => Object.keys(tools)))].sort()

  const analysisDir = getAnalysisDir(options.output, options.alias)
  const selections = selectCases(scenarios, tools, options.perGroup, options.seed)
  const selected = groupSelectedCases(selections)

  console.log(`Selected ${selected.size} cases in ${selections.length} groups`)

  const failed = new Set<string>()
  let index = 0
  selected.forEach(({ scenario, groups, focus }, id) => {
    index++
    const caseDir = getCaseDir(analysisDir, id)
    const casePath = path.join(caseDir, 'case.json')

    let commits: Commits
    if (fileExists(casePath)) {
      commits = readJSON<CaseInfo>(casePath).commits
    } else {
      console.log(`[${index}/${selected.size}] ${scenario.project} ${scenario.filepath}`)
      try {
        commits = runCaseTools(scenario, tools, projectsPath, caseDir)
      } catch (error) {
        console.error(`Skipped ${id} (${getScenarioKey(scenario)}): ${String(error)}`)
        removeDir(caseDir)
        failed.add(id)
        return
      }
    }

    const info = describeCase(scenario, tools, caseDir, commits)
    if (!info.reproduced) console.error(`Not reproduced: ${id} (${info.mismatches.join(', ')})`)

    writeJSON(casePath, { ...info, groups: groups.sort(), focus: Array.from(focus).sort() })
  })

  const selection: Selection = {
    resultsPath: path.resolve(resultsPath),
    projectsPath: path.resolve(projectsPath),
    perGroup: options.perGroup,
    seed: options.seed,
    groups: selections.map(({ group }) => ({ ...group, cases: group.cases.filter(id => !failed.has(id)) }))
  }
  writeJSON(getSelectionPath(analysisDir), selection)

  checkCases(options.alias, { output: options.output })
}
