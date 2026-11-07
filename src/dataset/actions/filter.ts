import path from "path"
import { MergeScenarioFile, Repo } from "../../index.js"
import { DatasetOptions, getActionOutputPath } from "../index.js"
import { FILES_ACTION } from "./files.js"
import { createCSV, parseCSV } from "../../utils/csv.js"
import { fileExists } from "../../utils/file.js"

const name = 'filter'

const runAction = (repos: Repo[], options: DatasetOptions) => {
  const relevantProjectsByLanguage: Record<string, string[]> = options.languages.reduce((res, language) => ({
    ...res,
    [language]: []
  }), {})

  const filesActionOutputPath = getActionOutputPath(FILES_ACTION.name, options)
  repos.forEach(({ name, language }) => {
    const filesFilePath = path.join(filesActionOutputPath, `${name}.csv`)
    const files = parseCSV<MergeScenarioFile>(filesFilePath)

    const mergeCommits = new Set(files.map(({ mergeCommit }) => mergeCommit))
    if (mergeCommits.size >= options.maxCommits) relevantProjectsByLanguage[language].push(name)
  })

  const minProjects = Math.min(...options.languages.map(language => relevantProjectsByLanguage[language].length))

  const headers = ['name', 'path', 'language'] as const
  const data = repos.filter(({ name, language }) => {
    const index = relevantProjectsByLanguage[language].findIndex(project => project === name)
    return index >= 0 && index < minProjects
  })

  const outputPath = getActionOutputPath(name, options)
  const filename = path.join(outputPath, 'repos.csv')

  createCSV(filename, headers, data)
}

const isDone = (_repos: Repo[], options: DatasetOptions) => {
  const outputPath = getActionOutputPath(name, options)
  const filename = path.join(outputPath, 'repos.csv')

  return fileExists(filename)
}

export const FILTER_ACTION = {
  name,
  runAction,
  isDone
}
