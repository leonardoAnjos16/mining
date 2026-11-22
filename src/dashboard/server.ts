import fs from 'fs'
import http from 'http'
import path from 'path'
import { createServer as createViteServer } from 'vite'
import { collectCases, hasCases } from '../analysis/cases/annotations.js'
import { getAnalysisDir, getAnnotationsDir, getCaseDir } from '../analysis/cases/paths.js'
import { loadTables } from '../analysis/tables.js'
import { dirExists, fileExists } from '../utils/file.js'
import { createViteConfig, EXPORTED_FILES } from './config.js'

type ServeOptions = {
  output: string
  port: number
}

const CONTENT_TYPES: Record<string, string> = {
  '.csv': 'text/csv; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8'
}

const sendJSON = (response: http.ServerResponse, data: unknown, status = 200) => {
  response.writeHead(status, { 'Content-Type': CONTENT_TYPES['.json'], 'Cache-Control': 'no-store' })
  response.end(JSON.stringify(data))
}

const sendFile = (response: http.ServerResponse, filepath: string) => {
  response.writeHead(200, { 'Content-Type': CONTENT_TYPES[path.extname(filepath)] ?? 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' })
  fs.createReadStream(filepath).pipe(response)
}

const getAnalysisFile = (analysisDir: string, pathname: string) => {
  const filepath = path.resolve(analysisDir, `.${pathname}`)
  const isInside = filepath.startsWith(`${analysisDir}${path.sep}`)
  const isExported = EXPORTED_FILES.includes(path.relative(analysisDir, filepath))
  return isInside && !isExported && fileExists(filepath) ? filepath : undefined
}

export const serveDashboard = async (alias: string, options: ServeOptions) => {
  const analysisDir = getAnalysisDir(options.output, alias)
  const annotationsDir = getAnnotationsDir(options.output)
  if (!dirExists(analysisDir)) throw new Error(`Missing ${analysisDir}: run "analysis metrics" or "analysis cases" with -a ${alias} first`)

  const vite = await createViteServer({ ...createViteConfig('serve'), server: { middlewareMode: true }, appType: 'spa' })

  const handle = (request: http.IncomingMessage, response: http.ServerResponse) => {
    const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname)

    if (pathname === '/api/analysis') return sendJSON(response, loadTables(analysisDir))
    if (pathname === '/api/cases') return sendJSON(response, hasCases(analysisDir) ? collectCases(analysisDir, annotationsDir) : null)

    const caseId = pathname.match(/^\/api\/cases\/([0-9a-f]{12})$/)?.[1]
    if (caseId) {
      const dataPath = path.join(getCaseDir(analysisDir, caseId), 'data.json')
      return fileExists(dataPath) ? sendFile(response, dataPath) : sendJSON(response, { error: 'Missing case data: run "analysis cases" again' }, 404)
    }

    const filepath = getAnalysisFile(analysisDir, pathname)
    if (filepath) return sendFile(response, filepath)

    vite.middlewares(request, response)
  }

  http.createServer((request, response) => {
    try {
      handle(request, response)
    } catch (error) {
      sendJSON(response, { error: String(error) }, 500)
    }
  }).listen(options.port, '127.0.0.1', () => {
    console.log(`Dashboard for ${path.relative(process.cwd(), analysisDir)} at http://localhost:${options.port}/`)
    console.log('Annotations and labels are read on every request: edit them and refresh (or switch back to) the page.')
  })
}
