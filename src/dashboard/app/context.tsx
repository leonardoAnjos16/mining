import { createContext, useContext } from 'react'
import type { AnalysisData, CasesData } from '../../analysis/cases/types'
import type { State, Update } from './state'

export type AppContextValue = {
  state: State
  update: Update
  hidden: Set<string>
  toggleHidden: (name: string) => void
  analysis: AnalysisData
  cases: CasesData | null
}

export const AppContext = createContext<AppContextValue | null>(null)

export const useApp = () => {
  const value = useContext(AppContext)
  if (!value) throw new Error('useApp must be used inside AppContext')
  return value
}

export const useCases = () => {
  const { cases } = useApp()
  if (!cases) throw new Error('useCases must be used only when the analysis has cases')
  return cases
}
