import path from "path"
import { MergeScenarioFile, Repo } from "./index.js"
import { appendCSV, createCSV, parseCSV } from "./utils/csv.js"
import { dirExists, fileExists, getExtension, readFile, removeDir } from "./utils/file.js"
import { createFileRevision, runTools } from "./merge.js"

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

  inputRepos.forEach(({ name: project }) => {
    console.log(`Starting project ${project}`)

    const projectPath = path.join(projectsPath, project)
    const revisionsPath = path.join(filesPath, `${project}.csv`)
    const files = parseCSV<MergeScenarioFile>(revisionsPath)

    const tempOutputDir = path.join(outputDir, 'tmp')
    files.forEach(({ baseCommit, leftCommit, rightCommit, mergeCommit, filepath }) => {
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
    })

    console.log(`Finished project ${project}`)
  })
}