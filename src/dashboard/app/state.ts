import { useCallback, useEffect, useState } from 'react'

export const DEFAULTS = {
  subset: 'all',
  scope: '',
  tab: 'dataset',
  metric: 'afp',
  percentage: '1',
  time: 'trimmed',
  hidden: '',
  group: '',
  label: '',
  case: '',
  outputLeft: '',
  outputRight: ''
}

export type State = typeof DEFAULTS

export type Update = (changes: Partial<State>) => void

const readState = (): State => {
  const params = new URLSearchParams(location.hash.slice(1))
  return Object.fromEntries(Object.entries(DEFAULTS).map(([key, value]) => [key, params.get(key) ?? value])) as State
}

export const useHashState = () => {
  const [state, setState] = useState(readState)

  useEffect(() => {
    const onHashChange = () => setState(readState())
    addEventListener('hashchange', onHashChange)
    return () => removeEventListener('hashchange', onHashChange)
  }, [])

  const update: Update = useCallback(changes => {
    location.hash = new URLSearchParams({ ...readState(), ...changes }).toString()
  }, [])

  return { state, update }
}
