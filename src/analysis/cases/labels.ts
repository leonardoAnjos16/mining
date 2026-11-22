import { fileURLToPath } from 'url'
import { readJSON } from '../../utils/file.js'
import { Label } from './types.js'

const LABELS_PATH = fileURLToPath(new URL('../../../src/analysis/cases/labels.json', import.meta.url))

export const loadLabels = () => readJSON<Label[]>(LABELS_PATH)
