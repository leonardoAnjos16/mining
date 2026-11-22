import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { HelpPanel } from './components/HelpPanel'
import { PopoverProvider } from './components/Popover'
import { CasesTab, getLabelMetric } from './cases/CasesTab'
import { SUBSETS, TABS } from './constants'
import { AppContext } from './context'
import { useAnalysisData, useCasesData } from './data'
import { getHidden } from './helpers'
import { useHashState } from './state'
import { DatasetTab } from './tabs/DatasetTab'
import { PairsTab } from './tabs/PairsTab'
import { TimeTab } from './tabs/TimeTab'
import { ToolsTab } from './tabs/ToolsTab'

const TAB_COMPONENTS: Record<string, () => ReactNode> = {
  dataset: DatasetTab,
  tools: ToolsTab,
  pairs: PairsTab,
  time: TimeTab,
  cases: CasesTab
}

const getScopes = (tables: Record<string, unknown>, subset: string) => {
  const scopes: Record<'languages' | 'projects', string[]> = { languages: [], projects: [] }
  Object.keys(tables).forEach(file => {
    const match = file.match(/^([^/]+)\/(languages|projects)\/([^/]+)\/tools\.csv$/)
    if (match && match[1] === subset) scopes[match[2] as 'languages' | 'projects'].push(match[3])
  })
  Object.values(scopes).forEach(names => names.sort())
  return scopes
}

export const App = () => {
  const { state, update } = useHashState()
  const analysis = useAnalysisData()
  const cases = useCasesData()
  const [helpOpen, setHelpOpen] = useState(false)

  const hidden = useMemo(() => getHidden(state.hidden), [state.hidden])
  const toggleHidden = useCallback((name: string) => {
    const next = new Set(hidden)
    if (next.has(name)) next.delete(name)
    else next.add(name)
    update({ hidden: Array.from(next).join(',') })
  }, [hidden, update])

  if (analysis.error || cases.error) return <main><div className="error-box">{analysis.error ?? cases.error}</div></main>
  if (!analysis.data || cases.data === undefined) return <main><p className="loading">Loading…</p></main>

  const tables = analysis.data.tables
  const tab = TABS[state.tab] ? state.tab : 'dataset'
  const scopes = getScopes(tables, state.subset)
  const scope = state.scope && tables[`${state.subset}/${state.scope}/tools.csv`] ? state.scope : ''
  const context = { state: { ...state, tab, scope }, update, hidden, toggleHidden, analysis: analysis.data, cases: cases.data }
  const scopeDisabled = tab === 'cases' || tab === 'dataset'
  const Tab = TAB_COMPONENTS[tab]
  const tools = (tables['all/tools.csv']?.rows ?? []).map(row => String(row[0])).filter(name => name !== 'total')
  const hiddenOthers = Array.from(hidden).filter(name => !tools.includes(name))

  return (
    <AppContext.Provider value={context}>
      <PopoverProvider>
        <header>
          <h1>Merge analysis</h1>
          <label className={`scope-only ${scopeDisabled ? 'disabled' : ''}`} title={scopeDisabled ? 'Not used by this tab' : ''}>Files{' '}
            <select value={state.subset} disabled={scopeDisabled} onChange={event => update({ subset: event.target.value })}>
              {Object.entries(SUBSETS).filter(([name]) => tables[`${name}/tools.csv`]).map(([name, label]) => <option key={name} value={name}>{label}</option>)}
            </select>
          </label>
          <label className={`scope-only ${scopeDisabled ? 'disabled' : ''}`} title={scopeDisabled ? 'Not used by this tab' : ''}>Scope{' '}
            <select value={scope} disabled={scopeDisabled} onChange={event => update({ scope: event.target.value })}>
              <option value="">Overall</option>
              <optgroup label="Languages">{scopes.languages.map(name => <option key={name} value={`languages/${name}`}>{name}</option>)}</optgroup>
              <optgroup label="Projects">{scopes.projects.map(name => <option key={name} value={`projects/${name}`}>{name}</option>)}</optgroup>
            </select>
          </label>
          <nav id="tabs">
            {Object.entries(TABS).map(([name, label]) => <button key={name} className={name === tab ? 'active' : ''} onClick={() => update({ tab: name })}>{label}</button>)}
          </nav>
          {tools.length > 0 && (
            <div className="tool-toggles">
              Tools
              {tools.map(tool => (
                <button key={tool} className={`tool-toggle ${hidden.has(tool) ? 'off' : ''}`} title={hidden.has(tool) ? `Show ${tool}` : `Hide ${tool}`} onClick={() => toggleHidden(tool)}>{tool}</button>
              ))}
            </div>
          )}
          {hiddenOthers.length > 0 && (
            <div id="hidden">
              Hidden
              {hiddenOthers.map(name => <button key={name} title={`Show ${name}`} onClick={() => toggleHidden(name)}>{name} ×</button>)}
              <button onClick={() => update({ hidden: Array.from(hidden).filter(name => tools.includes(name)).join(',') })}>Show all</button>
            </div>
          )}
        </header>
        <main id="content"><Tab /></main>
        {tab === 'cases' && <HelpPanel metric={getLabelMetric(state, cases.data, hidden)} open={helpOpen} setOpen={setHelpOpen} />}
      </PopoverProvider>
    </AppContext.Provider>
  )
}
