import path from 'path'

export const getAnalysisDir = (output: string, alias: string) => path.resolve(output, 'analysis', alias)

export const getAnnotationsDir = (output: string) => path.resolve(output, 'annotations')

const getCasesDir = (analysisDir: string) => path.join(analysisDir, 'cases')

export const getCaseDir = (analysisDir: string, id: string) => path.join(getCasesDir(analysisDir), id)

export const getSelectionPath = (analysisDir: string) => path.join(getCasesDir(analysisDir), 'selection.json')

export const getAnnotationPath = (annotationsDir: string, id: string) => path.join(annotationsDir, `${id}.json`)
