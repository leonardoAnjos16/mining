import path from "path"
import { MergeScenarioFile, Repo } from "./index.js"
import { appendCSV, createCSV, parseCSV } from "./utils/csv.js"
import { dirExists, fileExists, getExtension, readFile, removeDir, writeFile } from "./utils/file.js"
import { createFileRevision, runTools } from "./merge.js"
import { formatDuration } from "./utils/log.js"
import { performance } from "perf_hooks"

type ExperimentOptions = {
  output: string
  alias?: string
  repeat?: number
  resume?: boolean
}

type MergeContext = {
  project: string
  mergeCommit: string
  filepath: string
}

export type ToolResult = MergeContext & {
  tool: string
  conflicts: number
  fail: boolean
  timeMeasurements: number[]
}

export type ComparisonResult = MergeContext & {
  tool: string
  otherTool: string
  sameContent: boolean
  sameNormalizedContent: boolean
}

const TOOL_RESULTS_HEADERS = ['project', 'mergeCommit', 'filepath', 'tool', 'conflicts', 'fail', 'timeMeasurements'] as const
const TOOL_RESULTS_TRANSFORMERS = { timeMeasurements: (value: number[]) => JSON.stringify(value) }

const COMPARISON_RESULTS_HEADERS = ['project', 'mergeCommit', 'filepath', 'tool', 'otherTool', 'sameContent', 'sameNormalizedContent'] as const

// Rows read back without transformers, so every value is the string stored in the CSV
type RawToolResult = Record<(typeof TOOL_RESULTS_HEADERS)[number], string>
type RawComparisonResult = Record<(typeof COMPARISON_RESULTS_HEADERS)[number], string>

const getScenarioKey = ({ project, mergeCommit, filepath }: MergeContext) => `${project}##${mergeCommit}##${filepath}`

// Reads a results CSV, dropping a trailing line left incomplete by an interrupted write
const readResultsCSV = <T extends RawToolResult | RawComparisonResult>(filepath: string, headers: readonly string[]) => {
  const content = readFile(filepath)
  const completeContent = content.slice(0, content.lastIndexOf('\n') + 1)

  const [headersRow] = completeContent.split('\n')
  if (headersRow !== headers.join(';')) {
    throw new Error(`Cannot resume: unexpected headers in ${filepath}`)
  }

  writeFile(filepath, completeContent)
  return parseCSV<T>(filepath)
}

/**
 * Prepares the results of a previous run for resuming and returns the keys of its completed scenarios.
 * A scenario is completed when tools.csv has a row for every tool; rows of incomplete scenarios are
 * removed from both files, so those scenarios run again without duplicating rows.
 */
const loadCompletedScenarios = (toolResultsPath: string, comparisonResultsPath: string, tools: string[]) => {
  const toolResults = readResultsCSV<RawToolResult>(toolResultsPath, TOOL_RESULTS_HEADERS)
  const comparisonResults = readResultsCSV<RawComparisonResult>(comparisonResultsPath, COMPARISON_RESULTS_HEADERS)

  const previousTools = new Set(toolResults.map(({ tool }) => tool))
  if (previousTools.size > 0 && (previousTools.size !== tools.length || tools.some(tool => !previousTools.has(tool)))) {
    throw new Error(`Cannot resume: previous run used tools ${JSON.stringify([...previousTools])}, but got ${JSON.stringify(tools)}`)
  }

  const toolsPerScenario = new Map<string, Set<string>>()
  toolResults.forEach(result => {
    const key = getScenarioKey(result)
    toolsPerScenario.set(key, (toolsPerScenario.get(key) ?? new Set()).add(result.tool))
  })

  const completed = new Set([...toolsPerScenario].filter(([_, scenarioTools]) => scenarioTools.size === tools.length).map(([key]) => key))

  const isCompleted = (result: MergeContext) => completed.has(getScenarioKey(result))
  createCSV(toolResultsPath, TOOL_RESULTS_HEADERS, toolResults.filter(isCompleted))
  createCSV(comparisonResultsPath, COMPARISON_RESULTS_HEADERS, comparisonResults.filter(isCompleted))

  return completed
}

const validateProjects = (inputFile: string, projectsPath: string, filesPath: string) => {
  const inputRepos = parseCSV<Repo>(inputFile)
  for (const { name } of inputRepos) {
    const repoPath = path.join(projectsPath, name)
    if (!dirExists(repoPath)) {
      throw new Error(`Missing repository for project ${name}`)
    }
  
    const revisionsPath = path.join(filesPath, `${name}.csv`)
    if (!fileExists(revisionsPath)) {
      throw new Error(`Missing revisions CSV for project ${name}`)
    }
  }

  return inputRepos
}

const getToolOutput = (outputDir: string, extension: string, tool: string) => {
  try {
    const mergeFile = path.join(outputDir, `${tool}.${extension}`)
    return readFile(mergeFile)
  } catch {
    return ''
  }
}

const computeToolResults = (toolOutput: string) => {
  return {
    conflicts: (toolOutput.match(/<<<<<<</g) ?? []).length,
    fail: toolOutput === ''
  }
}

const computeComparisonResults = (toolOutput: string, otherToolOutput: string) => {
  return {
    sameContent: toolOutput === otherToolOutput,
    sameNormalizedContent: toolOutput.replace(/\s+/g, '') === otherToolOutput.replace(/\s+/g, '')
  }
}

const computeResults = (
  mergeContext: MergeContext,
  tools: string[],
  timeMeasurements: Record<string, number[]>,
  outputDir: string,
  mergeFile: string
) => {
  const toolResults: ToolResult[] = []
  const comparisonResults: ComparisonResult[] = []

  const extension = getExtension(mergeFile)
  tools.forEach(tool => {
    const toolOutput = getToolOutput(outputDir, extension, tool)
    const { conflicts, fail } = computeToolResults(toolOutput)

    toolResults.push({
      ...mergeContext,
      tool,
      conflicts,
      fail,
      timeMeasurements: timeMeasurements[tool]
    })

    tools.forEach(otherTool => {
      if (otherTool !== tool) {
        const otherToolOutput = getToolOutput(outputDir, extension, otherTool)
        const { sameContent, sameNormalizedContent } = computeComparisonResults(toolOutput, otherToolOutput)
        comparisonResults.push({ ...mergeContext, tool, otherTool, sameContent, sameNormalizedContent })
      }
    })

    const groundTruthContent = readFile(mergeFile)
    const { sameContent, sameNormalizedContent } = computeComparisonResults(toolOutput, groundTruthContent)

    comparisonResults.push({
      ...mergeContext,
      tool,
      otherTool: 'ground-truth',
      sameContent,
      sameNormalizedContent
    })
  })

  return { toolResults, comparisonResults }
}

export const runExperiment = (inputFile: string, projectsPath: string, filesPath: string, tools: string[], options: ExperimentOptions) => {
  const inputRepos = validateProjects(inputFile, projectsPath, filesPath)
  if (options.resume && !options.alias) {
    throw new Error('--resume requires --alias to identify the run to continue')
  }

  const outputDir = path.resolve(options.output, 'experiment', options.alias ?? Date.now().toString())

  // Results are appended after every scenario, so partial results survive an interrupted run
  const toolResultsPath = path.join(outputDir, 'tools.csv')
  const comparisonResultsPath = path.join(outputDir, 'comparisons.csv')

  let completedScenarioKeys = new Set<string>()
  if (options.resume && fileExists(toolResultsPath) && fileExists(comparisonResultsPath)) {
    completedScenarioKeys = loadCompletedScenarios(toolResultsPath, comparisonResultsPath, tools)
  } else {
    if (options.resume) console.log('No previous results found, starting from scratch')

    createCSV<ToolResult>(toolResultsPath, TOOL_RESULTS_HEADERS, [], TOOL_RESULTS_TRANSFORMERS)
    createCSV<ComparisonResult>(comparisonResultsPath, COMPARISON_RESULTS_HEADERS, [])
  }

  // Loading every project's scenarios up front gives the total for progress reporting
  const projects = inputRepos.map(({ name: project }) => ({
    project,
    files: parseCSV<MergeScenarioFile>(path.join(filesPath, `${project}.csv`))
  }))

  const totalScenarios = projects.reduce((total, { files }) => total + files.length, 0)
  const isScenarioCompleted = (project: string, { mergeCommit, filepath }: MergeScenarioFile) =>
    completedScenarioKeys.has(getScenarioKey({ project, mergeCommit, filepath }))

  const skippedScenarios = projects.reduce(
    (total, { project, files }) => total + files.filter(file => isScenarioCompleted(project, file)).length,
    0
  )

  const start = performance.now()
  let completedScenarios = skippedScenarios
  let scenariosRunNow = 0 // the ETA only uses scenarios run in this session, since skipped ones take no time

  const logProgress = (projectIndex: number, project: string, fileIndex: number, filesCount: number, filepath: string) => {
    const elapsed = performance.now() - start
    const remaining = totalScenarios - completedScenarios
    const eta = scenariosRunNow > 0 ? `~${formatDuration((elapsed / scenariosRunNow) * remaining)}` : '?'

    const current = completedScenarios + 1
    const counter = `${current.toString().padStart(totalScenarios.toString().length)}/${totalScenarios}`
    const percentage = `${((completedScenarios / totalScenarios) * 100).toFixed(1)}%`

    console.log(
      `[${counter} ${percentage}] ${project} (project ${projectIndex + 1}/${projects.length}, file ${fileIndex + 1}/${filesCount}) ` +
      `${filepath} · elapsed ${formatDuration(elapsed)} · ETA ${eta}`
    )
  }

  console.log(`Running ${totalScenarios} scenarios from ${projects.length} projects`)
  if (skippedScenarios > 0) console.log(`Resuming: skipping ${skippedScenarios} scenarios that already have results`)

  projects.forEach(({ project, files }, projectIndex) => {
    console.log(`Starting project ${project}`)

    const projectPath = path.join(projectsPath, project)

    const tempOutputDir = path.join(outputDir, 'tmp')
    files.forEach((file, fileIndex) => {
      if (isScenarioCompleted(project, file)) return

      const { baseCommit, leftCommit, rightCommit, mergeCommit, filepath } = file
      logProgress(projectIndex, project, fileIndex, files.length, filepath)

      const mergeFile = createFileRevision(projectPath, mergeCommit, filepath, tempOutputDir, 'merge')
      const timeMeasurements = runTools(tools, projectPath, baseCommit, leftCommit, rightCommit, filepath, tempOutputDir, options.repeat)

      const results = computeResults(
        { project, mergeCommit, filepath },
        tools,
        timeMeasurements,
        tempOutputDir,
        mergeFile
      )

      // tools.csv is written last: a scenario counts as completed once its tool results are saved
      appendCSV(comparisonResultsPath, COMPARISON_RESULTS_HEADERS, results.comparisonResults)
      appendCSV(toolResultsPath, TOOL_RESULTS_HEADERS, results.toolResults, TOOL_RESULTS_TRANSFORMERS)

      removeDir(tempOutputDir)
      completedScenarios++
      scenariosRunNow++
    })

    console.log(`Finished project ${project}`)
  })

  console.log(`Finished ${totalScenarios - skippedScenarios} scenarios in ${formatDuration(performance.now() - start)}`)
}