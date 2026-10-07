import fs from 'fs'
import path from 'path'

export const dirExists = path => fs.existsSync(path) && fs.statSync(path).isDirectory()

export const fileExists = path => fs.existsSync(path) && fs.statSync(path).isFile()

export const removeDir = path => fs.rmSync(path, { recursive: true, force: true })

export const createDir = path => fs.mkdirSync(path, { recursive: true })

export const readFile = filepath => fs.readFileSync(filepath, 'utf-8')

export const writeFile = (filepath, content) => {
  createDir(path.dirname(filepath))
  fs.writeFileSync(filepath, content)
}
