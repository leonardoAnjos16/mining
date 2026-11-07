import path from "path"
import { MergeScenarioFile, Repo } from "./index.js"
import { appendCSV, createCSV, parseCSV } from "./utils/csv.js"
import { dirExists, fileExists, getExtension, readFile, removeDir } from "./utils/file.js"
import { createFileRevision, runTools } from "./merge.js"
import { formatDuration } from "./utils/log.js"
import { performance } from "perf_hooks"

type ExperimentOptions = {
  output: string
  alias?: string
  repeat?: number
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
  const outputDir = path.resolve(options.output, 'experiment', options.alias ?? Date.now().toString())

  // Results are appended after every scenario, so partial results survive an interrupted run
  const toolResultsPath = path.join(outputDir, 'tools.csv')
  createCSV<ToolResult>(toolResultsPath, TOOL_RESULTS_HEADERS, [], TOOL_RESULTS_TRANSFORMERS)

  const comparisonResultsPath = path.join(outputDir, 'comparisons.csv')
  createCSV<ComparisonResult>(comparisonResultsPath, COMPARISON_RESULTS_HEADERS, [])

  // Loading every project's scenarios up front gives the total for progress reporting
  const projects = inputRepos.map(({ name: project }) => ({
    project,
    files: parseCSV<MergeScenarioFile>(path.join(filesPath, `${project}.csv`))
  }))

  const totalScenarios = projects.reduce((total, { files }) => total + files.length, 0)
  const start = performance.now()
  let completedScenarios = 0

  const logProgress = (projectIndex: number, project: string, fileIndex: number, filesCount: number, filepath: string) => {
    const elapsed = performance.now() - start
    const remaining = totalScenarios - completedScenarios
    const eta = completedScenarios > 0 ? `~${formatDuration((elapsed / completedScenarios) * remaining)}` : '?'

    const current = completedScenarios + 1
    const counter = `${current.toString().padStart(totalScenarios.toString().length)}/${totalScenarios}`
    const percentage = `${((completedScenarios / totalScenarios) * 100).toFixed(1)}%`

    console.log(
      `[${counter} ${percentage}] ${project} (project ${projectIndex + 1}/${projects.length}, file ${fileIndex + 1}/${filesCount}) ` +
      `${filepath} · elapsed ${formatDuration(elapsed)} · ETA ${eta}`
    )
  }

  console.log(`Running ${totalScenarios} scenarios from ${projects.length} projects`)

  projects.forEach(({ project, files }, projectIndex) => {
    console.log(`Starting project ${project}`)

    const projectPath = path.join(projectsPath, project)

    const tempOutputDir = path.join(outputDir, 'tmp')
    files.forEach(({ baseCommit, leftCommit, rightCommit, mergeCommit, filepath }, fileIndex) => {
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

      appendCSV(toolResultsPath, TOOL_RESULTS_HEADERS, results.toolResults, TOOL_RESULTS_TRANSFORMERS)
      appendCSV(comparisonResultsPath, COMPARISON_RESULTS_HEADERS, results.comparisonResults)

      removeDir(tempOutputDir)
      completedScenarios++
    })

    console.log(`Finished project ${project}`)
  })

  console.log(`Finished ${totalScenarios} scenarios in ${formatDuration(performance.now() - start)}`)
}