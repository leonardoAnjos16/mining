import path from 'path'
import { fileURLToPath } from 'url'
import { InlineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

export const APP_ROOT = fileURLToPath(new URL('../../src/dashboard/app', import.meta.url))

export const BUILD_DIR = path.resolve(APP_ROOT, '../../../node_modules/.cache/dashboard')

export const EXPORTED_FILES = ['index.html', 'data.js', 'cases.js']

export const createViteConfig = (mode: 'serve' | 'build'): InlineConfig => ({
  root: APP_ROOT,
  configFile: false,
  logLevel: 'warn',
  plugins: mode === 'build' ? [react(), viteSingleFile()] : [react()],
  build: { outDir: BUILD_DIR, emptyOutDir: true }
})
