import { useEffect, useState } from 'react'
import ReactSelect from 'react-select'
import OllamaSettings from './OllamaSettings'
import { AI } from '../services/AI'
import { Debate } from '../debate/Debate'
import { useUiStrings } from '../i18n/UiStringsContext'
import { modelSelectStyles } from './Style'
import { thinkingLevelOptions } from './ThinkingLevels'

// How long the dialog keeps asking the client whether the login went through.
const LOGIN_WAIT_MS = 3 * 60 * 1000

// The dialog clips its body, so the menu is portalled above the overlay.
const portalledSelectStyles = { ...modelSelectStyles, menuPortal: base => ({ ...base, zIndex: 1200 }) }

/**
 * The reasoning level participants on this provider follow unless they picked
 * their own. It sits with the provider because it belongs to it: the level
 * that suits a hosted model is rarely the one that suits a local one.
 */
function DefaultThinkingLevel({ value, onChange, disabled }) {
  const UI_STRINGS = useUiStrings()
  const options = thinkingLevelOptions(UI_STRINGS.participants)
  const selected = Debate.normalizeThinkingLevel(value)
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
    <span style={{ color: '#888', fontSize: 12 }} title={UI_STRINGS.app.defaultThinkingLevelTitle}>{UI_STRINGS.app.defaultThinkingLevel}</span>
    <ReactSelect
      styles={portalledSelectStyles}
      menuPortalTarget={document.body}
      options={options}
      value={options.find(option => option.value === selected)}
      onChange={option => onChange?.(option?.value ?? Debate.DEFAULT_THINKING_LEVEL)}
      isDisabled={disabled}
      menuPlacement="auto"
    />
  </div>
}

const PROVIDERS = [
  { id: 'ollama', label: 'Ollama', detail: 'Local HTTP' },
  { id: 'ollama-cloud', label: 'Ollama Cloud', detail: 'API key' },
  { id: 'openai', label: 'OpenAI', detail: 'Codex CLI · OAuth' },
  { id: 'claude', label: 'Claude', detail: 'Claude CLI · OAuth' },
]

function ModelList({ providerId, models, defaultModel, onDefaultModelChange, selectedModel, onSelectedModelChange, disabledModels = [], onToggleModel, onSetAllModelsEnabled, disabled, empty }) {
  const orderedModels = AI.orderModels(models, { defaultModel })
  const disabledSet = new Set(disabledModels)
  const enabledCount = models.filter(model => !disabledSet.has(model)).length
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
      <span style={{ color: '#888', fontSize: 12 }}>Models · {enabledCount}/{models.length} enabled</span>
      {!!models.length && <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" onClick={() => onSetAllModelsEnabled?.(true)} disabled={disabled} style={{ background: 'transparent', border: '1px solid #333', borderRadius: 5, color: '#888', fontSize: 10, padding: '2px 7px' }}>Enable all</button>
        <button type="button" onClick={() => onSetAllModelsEnabled?.(false)} disabled={disabled} style={{ background: 'transparent', border: '1px solid #333', borderRadius: 5, color: '#888', fontSize: 10, padding: '2px 7px' }}>Disable all</button>
      </div>}
    </div>
    {orderedModels.length
      ? orderedModels.map(model => {
          const enabled = !disabledSet.has(model)
          const selected = onSelectedModelChange ? model === selectedModel : model === defaultModel
          return <div key={model} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', padding: '7px 9px', border: `1px solid ${selected ? '#3f5a8a' : '#252525'}`, borderRadius: 7, color: enabled ? '#ccc' : '#666', fontSize: 12 }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
              <input type="radio" name={`${providerId}${onSelectedModelChange ? 'Selected' : 'Default'}Model`} checked={selected} onChange={() => onSelectedModelChange ? onSelectedModelChange(model) : onDefaultModelChange?.(model)} disabled={disabled || !enabled} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{model}</span>
            </label>
            <div
              onClick={() => !disabled && onToggleModel?.(model, !enabled)}
              role="switch"
              aria-checked={enabled}
              aria-label={`Enable ${model}`}
              style={{ width: 34, height: 18, borderRadius: 9, position: 'relative', flexShrink: 0, background: enabled ? '#4ade80' : '#444', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.55 : 1, transition: 'background 0.2s' }}
            >
              <div style={{ position: 'absolute', top: 2, left: enabled ? 18 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
            </div>
          </div>
        })
      : <span style={{ color: '#777', fontSize: 11 }}>{empty}</span>}
  </div>
}

export default function ProviderSettings({ providerId, onProviderChange, onRefreshProvider, ollamaCloudHasSavedKey = false, onOllamaCloudConnect, models = [], defaultModel, onDefaultModelChange, defaultThinkingLevel, onDefaultThinkingLevelChange, selectedModel, onSelectedModelChange, disabled, ...ollamaProps }) {
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [cloudKey, setCloudKey] = useState('')
  const [actionError, setActionError] = useState('')
  // Which provider is mid-login, so switching tab drops the wait by itself.
  const [loginPending, setLoginPending] = useState('')
  const waitingForLogin = loginPending === providerId
  const native = providerId === 'openai' || providerId === 'claude'
  const cloud = providerId === 'ollama-cloud'

  const refresh = async () => {
    if (!native || !window.desktop?.aiStatus) return
    setBusy(true)
    try {
      const next = await window.desktop.aiStatus(providerId)
      setStatus(next)
      return next
    } finally { setBusy(false) }
  }
  useEffect(() => {
    if (!native) return undefined
    const timer = window.setTimeout(() => { void refresh() }, 0)
    return () => window.clearTimeout(timer)
  }, [providerId]) // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * The login happens in a terminal of its own, so there is nothing to await:
   * the client is asked how it went until it says it is logged in. A single
   * check a second later always landed before the user had finished.
   */
  const login = async () => {
    setActionError('')
    setBusy(true)
    try {
      await window.desktop?.aiLogin?.(providerId)
      setLoginPending(providerId)
    } catch (error) {
      setActionError(error?.message || String(error))
    } finally { setBusy(false) }
  }
  useEffect(() => {
    if (!waitingForLogin) return undefined
    const started = Date.now()
    const timer = window.setInterval(async () => {
      const next = await window.desktop?.aiStatus?.(providerId).catch(() => null)
      if (next) setStatus(next)
      if (next?.authenticated) {
        setLoginPending('')
        onRefreshProvider?.()
      } else if (Date.now() - started > LOGIN_WAIT_MS) {
        setLoginPending('')
      }
    }, 3000)
    return () => window.clearInterval(timer)
  }, [waitingForLogin, providerId]) // eslint-disable-line react-hooks/exhaustive-deps
  const connectCloud = async () => {
    setBusy(true)
    setActionError('')
    try { await onOllamaCloudConnect?.(cloudKey) } catch (error) { setActionError(error?.message || String(error)) } finally { setBusy(false) }
  }

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
      {PROVIDERS.map(provider => <button key={provider.id} type="button" disabled={disabled} onClick={() => onProviderChange?.(provider.id)} style={{ textAlign: 'left', border: `1px solid ${providerId === provider.id ? '#3f5a8a' : '#333'}`, borderRadius: 7, background: providerId === provider.id ? '#1f2a3f' : '#111', color: providerId === provider.id ? '#9fc2ff' : '#aaa', padding: '10px', cursor: disabled ? 'default' : 'pointer' }}>
        <strong style={{ display: 'block', fontSize: 12 }}>{provider.label}</strong><span style={{ fontSize: 10, color: '#777' }}>{provider.detail}</span>
      </button>)}
    </div>

    {onDefaultThinkingLevelChange && <DefaultThinkingLevel value={defaultThinkingLevel} onChange={onDefaultThinkingLevelChange} disabled={disabled} />}

    {providerId === 'ollama' && <OllamaSettings {...ollamaProps} models={models} defaultModel={defaultModel} onSelectDefaultModel={onDefaultModelChange} selectedModel={selectedModel} onSelectModel={onSelectedModelChange} disabled={disabled} />}

    {cloud && <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <span style={{ color: '#888', fontSize: 12 }}>Ollama Cloud API key</span>
        <span style={{ color: '#666', fontSize: 11 }}>Used with https://ollama.com. In the desktop app it is encrypted with the operating system credential protection.</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="password" value={cloudKey} onChange={event => setCloudKey(event.target.value)} placeholder={ollamaCloudHasSavedKey ? 'Saved key — enter a new key to replace it' : 'Enter API key'} autoComplete="off" disabled={disabled || busy} style={{ flex: 1, minWidth: 0, background: '#0f0f0f', border: '1px solid #2e2e2e', borderRadius: 6, color: '#ddd', fontSize: 12, padding: '6px 9px' }} />
          <button onClick={connectCloud} disabled={disabled || busy || (!cloudKey.trim() && !ollamaCloudHasSavedKey)} style={{ background: '#1f2a3f', border: '1px solid #3f5a8a', color: '#9fc2ff', borderRadius: 6, padding: '5px 12px' }}>{busy ? 'Connecting…' : ollamaCloudHasSavedKey && !cloudKey.trim() ? 'Refresh' : 'Connect'}</button>
        </div>
        {!!(actionError || ollamaProps.connectError) && <span style={{ color: '#f87171', fontSize: 11 }}>{actionError || ollamaProps.connectError}</span>}
      </div>
      <ModelList providerId={providerId} models={models} defaultModel={defaultModel} onDefaultModelChange={onDefaultModelChange} selectedModel={selectedModel} onSelectedModelChange={onSelectedModelChange} disabledModels={ollamaProps.disabledModels} onToggleModel={ollamaProps.onToggleModel} onSetAllModelsEnabled={ollamaProps.onSetAllModelsEnabled} disabled={disabled} empty="Connect with an API key to retrieve the available cloud models." />
    </div>}

    {native && <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ border: '1px solid #2e2e2e', borderRadius: 7, padding: 12, background: '#101010', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div><strong style={{ color: '#ddd', fontSize: 12 }}>{PROVIDERS.find(item => item.id === providerId)?.label} client</strong><div style={{ color: status?.authenticated ? '#4ade80' : '#888', fontSize: 11, marginTop: 4 }}>{status?.authenticated ? 'Connected through OAuth' : status?.installed === false ? 'Client not found' : waitingForLogin ? 'Finish the login in the terminal window…' : 'Login required'}</div><small style={{ color: '#666' }}>AI Debate does not store or handle OAuth tokens.</small></div>
        <div style={{ display: 'flex', gap: 6 }}><button onClick={() => { void refresh().then(next => { if (next?.authenticated) onRefreshProvider?.() }) }} disabled={busy} style={{ background: 'transparent', border: '1px solid #3a3a3a', color: '#aaa', borderRadius: 6, padding: '5px 9px' }}>{busy ? 'Checking…' : 'Refresh'}</button>{!status?.authenticated && <button onClick={login} disabled={busy || waitingForLogin || status?.installed === false} style={{ background: '#1f2a3f', border: '1px solid #3f5a8a', color: '#9fc2ff', borderRadius: 6, padding: '5px 9px' }}>{waitingForLogin ? 'Waiting…' : 'Login'}</button>}</div>
      </div>
      {!!actionError && native && <span style={{ color: '#f87171', fontSize: 11 }}>{actionError}</span>}
      <ModelList providerId={providerId} models={models} defaultModel={defaultModel} onDefaultModelChange={onDefaultModelChange} selectedModel={selectedModel} onSelectedModelChange={onSelectedModelChange} disabledModels={ollamaProps.disabledModels} onToggleModel={ollamaProps.onToggleModel} onSetAllModelsEnabled={ollamaProps.onSetAllModelsEnabled} disabled={disabled} empty={status?.authenticated ? 'Refresh to load the available models.' : 'Log in to load models.'} />
    </div>}
  </div>
}
