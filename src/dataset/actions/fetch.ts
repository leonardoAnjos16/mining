import path from "path"
import { DatasetOptions, getActionOutputPath } from "../index.js"
import { Octokit } from "octokit"
import { Repo } from "../../index.js"
import { createCSV } from "../../utils/csv.js"
import { fileExists } from "../../utils/file.js"

export const getFetchOutputFile = (options: DatasetOptions) => {
  const fetchOutputPath = getActionOutputPath('fetch', options)
  return path.join(fetchOutputPath, 'repos.csv')
}

export const runFetchAction = async (options: DatasetOptions) => {
  const octokit = new Octokit()
  const getTopRepos = async (language: string) => {
    console.log(`Fetching repos written in ${language}`)
    const { data } = await octokit.rest.search.repos({
      q: `language:${language}`,
      sort: 'stars',
      order: 'desc',
      per_page: options.maxRepos
    })

    return data.items
  }

  const repos: Repo[] = []
  for (const language of options.languages) {
    const topRepos = await getTopRepos(language)
    topRepos.forEach(repo => {
      repos.push({
        name: repo.name,
        path: repo.clone_url
      })
    })
  }

  const headers = ['name', 'path'] as const
  const filename = getFetchOutputFile(options)

  createCSV(filename, headers, repos)
}

export const isFetchDone = (options: DatasetOptions) => {
  return fileExists(getFetchOutputFile(options))
}
