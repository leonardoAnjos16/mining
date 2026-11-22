import path from 'path'
import { build } from 'vite'
import { collectCases, getCaseErrors, hasCases } from '../analysis/cases/annotations.js'
import { getAnalysisDir, getAnnotationsDir, getCaseDir } from '../analysis/cases/paths.js'
import { loadTables } from '../analysis/tables.js'
import { dirExists, fileExists, readFile, removeFile, writeFile } from '../utils/file.js'
import { BUILD_DIR, createViteConfig } from './config.js'

type ExportOptions = {
  output: string
}

const DATA_SCRIPTS = '<script src="data.js"></script><script src="cases.js"></script>'

const LEGACY_FILES = ['highlight.js', 'highlight.css']

export const exportDashboard = async (alias: string, options: ExportOptions) => {
  const analysisDir = getAnalysisDir(options.output, alias)
  if (!dirExists(analysisDir)) throw new Error(`Missing ${analysisDir}`)

  const cases = hasCases(analysisDir) ? collectCases(analysisDir, getAnnotationsDir(options.output)) : null
  const errors = cases ? getCaseErrors(cases) : []
  if (errors.length > 0) {
    console.error(`Invalid labels or annotations, nothing was exported:\n${errors.map(error => `  ${error}`).join('\n')}`)
    process.exitCode = 1
    return
  }

  await build(createViteConfig('build'))
  const page = readFile(path.join(BUILD_DIR, 'index.html')).replace('<head>', `<head>${DATA_SCRIPTS}`)

  writeFile(path.join(analysisDir, 'index.html'), page)
  writeFile(path.join(analysisDir, 'data.js'), `window.ANALYSIS = ${JSON.stringify(loadTables(analysisDir))}\n`)
  writeFile(path.join(analysisDir, 'cases.js'), `window.CASES = ${JSON.stringify(cases)}\n`)
  LEGACY_FILES.forEach(file => removeFile(path.join(analysisDir, file)))

  Object.keys(cases?.cases ?? {}).forEach(id => {
    const caseDir = getCaseDir(analysisDir, id)
    const dataPath = path.join(caseDir, 'data.json')
    if (!fileExists(dataPath)) return
    writeFile(path.join(caseDir, 'data.js'), `window.CASE_DATA = window.CASE_DATA || {}\nwindow.CASE_DATA[${JSON.stringify(id)}] = ${readFile(dataPath)}\n`)
  })

  console.log(`Exported ${path.relative(process.cwd(), analysisDir)}: open its index.html, or share the whole folder.`)
}
