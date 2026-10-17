import path from "path"
import { ToolResult } from "../experiment.js"
import { createCSV } from "../utils/csv.js"

export const computeProjectMetrics = (toolResults: ToolResult[], outputDir: string) => {
  const scenariosByProject: Record<string, Set<string>> = {}
  const filesByProject: Record<string, Set<string>> = {}

  toolResults.forEach(({ project, mergeCommit, filepath }) => {
    if (!scenariosByProject[project]) {
      scenariosByProject[project] = new Set()
      filesByProject[project] = new Set()
    }

    scenariosByProject[project].add(mergeCommit)
    filesByProject[project].add(`${mergeCommit}##${filepath}`)
  })

  const projects = Object.keys(scenariosByProject).sort()

  const headers = ['project', 'scenarios', 'files'] as const
  const data = projects.map(project => ({
    project,
    scenarios: scenariosByProject[project].size,
    files: filesByProject[project].size
  }))

  const filename = path.join(outputDir, 'counts.csv')
  createCSV(filename, headers, data)
}
