import { useCallback, useEffect, useState } from 'react'
import type { AnalysisData, CaseData, CasesData } from '../../analysis/cases/types'

declare global {
  interface Window {
    ANALYSIS?: AnalysisData
    CASES?: CasesData | null
    CASE_DATA?: Record<string, CaseData>
  }
}

export const isStatic = () => window.ANALYSIS !== undefined

const fetchJSON = async <T>(url: string): Promise<T> => {
  const response = await fetch(url, { cache: 'no-store' })
  const data = await response.json()
  if (!response.ok) throw new Error(data?.error ?? `${url}: ${response.status}`)
  return data
}

const loadScript = (src: string) => new Promise<void>((resolve, reject) => {
  const script = document.createElement('script')
  script.src = src
  script.onload = () => resolve()
  script.onerror = () => reject(new Error(`Could not load ${src}`))
  document.body.append(script)
})

const loadCaseData = async (id: string): Promise<CaseData> => {
  if (!isStatic()) return fetchJSON<CaseData>(`api/cases/${id}`)
  if (!window.CASE_DATA?.[id]) await loadScript(`cases/${id}/data.js`)
  const data = window.CASE_DATA?.[id]
  if (!data) throw new Error(`cases/${id}/data.js has no data for this case`)
  return data
}

type Loaded<T> = { data?: T, error?: string }

const useLoader = <T>(load: () => Promise<T>, reloadOnFocus: boolean) => {
  const [loaded, setLoaded] = useState<Loaded<T>>({})

  const reload = useCallback(() => {
    load().then(data => setLoaded({ data }), (error: unknown) => setLoaded({ error: String(error) }))
  }, [load])

  useEffect(() => {
    reload()
    if (!reloadOnFocus) return
    const onVisible = () => { if (document.visibilityState === 'visible') reload() }
    addEventListener('focus', reload)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      removeEventListener('focus', reload)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [reload, reloadOnFocus])

  return loaded
}

const loadAnalysis = () => isStatic() ? Promise.resolve(window.ANALYSIS!) : fetchJSON<AnalysisData>('api/analysis')

const loadCases = () => isStatic() ? Promise.resolve(window.CASES ?? null) : fetchJSON<CasesData | null>('api/cases')

export const useAnalysisData = () => useLoader(loadAnalysis, false)

export const useCasesData = () => useLoader(loadCases, !isStatic())

export const useCaseData = (id: string) => {
  const load = useCallback(() => loadCaseData(id), [id])
  return useLoader(load, false)
}
