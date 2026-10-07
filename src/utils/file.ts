import fs from 'fs'
import path from 'path'

export const dirExists = (path: string) => fs.existsSync(path) && fs.statSync(path).isDirectory()

export const fileExists = (path: string) => fs.existsSync(path) && fs.statSync(path).isFile()

export const removeDir = (path: string) => fs.rmSync(path, { recursive: true, force: true })

export const createDir = (path: string) => fs.mkdirSync(path, { recursive: true })

export const readFile = (filepath: string) => fs.readFileSync(filepath, 'utf-8')

export const writeFile = (filepath: string, content: string) => {
  createDir(path.dirname(filepath))
  fs.writeFileSync(filepath, content)
}
