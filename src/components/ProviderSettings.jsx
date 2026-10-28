import { useEffect, useState } from 'react'
import ReactSelect from 'react-select'
import OllamaSettings from './OllamaSettings'
import { AI } from '../services/AI'
import { Debate } from '../debate/Debate'
import { useUiStrings } from '../i18n/UiStringsContext'
import { modelSelectStyles } from './Style'
import { thinkingLevelOptions } from './ThinkingLevels'
import {
  CODEX_SANDBOXES,
  KEY_PROVIDER_IDS,
  PROVIDER_OPTION_FIELDS,
  clampThinkingLevel,
  providerThinkingLevelOptions,
} from '../settings/Settings'
import { CLI_PROVIDER_IDS, KEY_PROVIDER_DETAILS, PROVIDER_CATALOG } from './ProviderCatalog'

// How long the dialog keeps asking the client whether the login went through.
const LOGIN_WAIT_MS = 3 * 60 * 1000

// The dialog clips its body, so the menu is portalled above the overlay.
const portalledSelectStyles = { ...modelSelectStyles, menuPortal: base => ({ ...base, zIndex: 1200 }) }

/**
 * The reasoning level participants on this provider follow unless they picked
 * their own. It sits with the provider because it belongs to it: the level
 * that suits a hosted model is rarely the one that suits a local one, and not
 * every provider offers the same steps.
 */
function DefaultThinkingLevel({ providerId, value, onChange, disabled }) {
  const UI_STRINGS = useUiStrings()
  const offered = providerThinkingLevelOptions(providerId)
  const options = thinkingLevelOptions(UI_STRINGS.participants).filter(option => offered.includes(option.value))
  const selected = clampThinkingLevel(providerId, Debate.normalizeThinkingLevel(value))
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
    <span style={{ color: 'var(--c-888888, #888)', fontSize: 12 }} title={UI_STRINGS.app.defaultThinkingLevelTitle}>{UI_STRINGS.app.defaultThinkingLevel}</span>
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

const fieldStyle = { background: 'var(--c-0f0f0f, #0f0f0f)', border: '1px solid var(--c-2e2e2e, #2e2e2e)', borderRadius: 6, color: 'var(--c-dddddd, #ddd)', fontSize: 12, padding: '6px 9px', width: '100%', minWidth: 0 }

/**
 * The generation parameters of the active provider.
 *
 * Every field is optional and an empty one means the model's own default, so
 * the request carries only what was actually set. Which fields exist depends
 * on the provider: only Ollama can be told how long to stay loaded, and only
 * Codex runs in a sandbox.
 */
function AdvancedOptions({ providerId, options = {}, onChange, disabled }) {
  const fields = PROVIDER_OPTION_FIELDS[providerId] ?? []
  const [open, setOpen] = useState(false)
  if (fields.length === 0) return null
  const set = (field, value) => onChange?.({ ...options, [field]: value })
  const numberField = (field, label, hint, extra = {}) => <label key={field} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <span style={{ color: 'var(--c-888888, #888)', fontSize: 11 }}>{label}</span>
    <input type="number" value={options[field] ?? ''} onChange={event => set(field, event.target.value === '' ? '' : Number(event.target.value))} disabled={disabled} style={fieldStyle} {...extra} />
    <span style={{ color: 'var(--c-666666, #666)', fontSize: 10 }}>{hint}</span>
  </label>

  return <div style={{ border: '1px solid var(--c-252525, #252525)', borderRadius: 7, background: 'var(--c-0d0d0d, #0d0d0d)' }}>
    <button type="button" onClick={() => setOpen(value => !value)} style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', color: 'var(--c-999999, #999)', fontSize: 12, padding: '9px 11px', cursor: 'pointer' }}>
      {open ? '▾' : '▸'} Advanced generation parameters
    </button>
    {open && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, padding: '0 11px 11px' }}>
      {fields.includes('temperature') && numberField('temperature', 'Temperature', 'Empty: the model default. 0–2.', { step: 0.1, min: 0, max: 2 })}
      {fields.includes('numPredict') && numberField('numPredict', 'Max tokens', 'Longest answer the model may write.', { step: 1, min: 1 })}
      {fields.includes('numCtx') && numberField('numCtx', 'Context window', 'Tokens the model keeps in context.', { step: 512, min: 512 })}
      {fields.includes('keepAlive') && <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ color: 'var(--c-888888, #888)', fontSize: 11 }}>Keep loaded</span>
        <input type="text" value={options.keepAlive ?? ''} onChange={event => set('keepAlive', event.target.value)} placeholder="5m" disabled={disabled} style={fieldStyle} />
        <span style={{ color: 'var(--c-666666, #666)', fontSize: 10 }}>How long the model stays in memory after a turn: 30s, 10m, -1 to keep it.</span>
      </label>}
      {fields.includes('sandbox') && <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ color: 'var(--c-888888, #888)', fontSize: 11 }}>Sandbox</span>
        <select value={options.sandbox ?? 'read-only'} onChange={event => set('sandbox', event.target.value)} disabled={disabled} style={fieldStyle}>
          {CODEX_SANDBOXES.map(value => <option key={value} value={value}>{value}</option>)}
        </select>
        <span style={{ color: 'var(--c-666666, #666)', fontSize: 10 }}>What the client may reach. The debate gives it no tools, so read-only is enough.</span>
      </label>}
    </div>}
  </div>
}

function ModelList({ providerId, models, defaultModel, onDefaultModelChange, selectedModel, onSelectedModelChange, disabledModels = [], onToggleModel, onSetAllModelsEnabled, disabled, empty }) {
  const orderedModels = AI.orderModels(models, { defaultModel })
  const disabledSet = new Set(disabledModels)
  const enabledCount = models.filter(model => !disabledSet.has(model)).length
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
      <span style={{ color: 'var(--c-888888, #888)', fontSize: 12 }}>Models · {enabledCount}/{models.length} enabled</span>
      {!!models.length && <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" onClick={() => onSetAllModelsEnabled?.(true)} disabled={disabled} style={{ background: 'transparent', border: '1px solid var(--c-333333, #333)', borderRadius: 5, color: 'var(--c-888888, #888)', fontSize: 10, padding: '2px 7px' }}>Enable all</button>
        <button type="button" onClick={() => onSetAllModelsEnabled?.(false)} disabled={disabled} style={{ background: 'transparent', border: '1px solid var(--c-333333, #333)', borderRadius: 5, color: 'var(--c-888888, #888)', fontSize: 10, padding: '2px 7px' }}>Disable all</button>
      </div>}
    </div>
    {orderedModels.length
      ? orderedModels.map(model => {
          const enabled = !disabledSet.has(model)
          const selected = onSelectedModelChange ? model === selectedModel : model === defaultModel
          return <div key={model} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', padding: '7px 9px', border: `1px solid ${selected ? 'var(--c-3f5a8a, #3f5a8a)' : 'var(--c-252525, #252525)'}`, borderRadius: 7, color: enabled ? 'var(--c-cccccc, #ccc)' : 'var(--c-666666, #666)', fontSize: 12 }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
              <input type="radio" name={`${providerId}${onSelectedModelChange ? 'Selected' : 'Default'}Model`} checked={selected} onChange={() => onSelectedModelChange ? onSelectedModelChange(model) : onDefaultModelChange?.(model)} disabled={disabled || !enabled} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{model}</span>
            </label>
            <div
              onClick={() => !disabled && onToggleModel?.(model, !enabled)}
              role="switch"
              aria-checked={enabled}
              aria-label={`Enable ${model}`}
              style={{ width: 34, height: 18, borderRadius: 9, position: 'relative', flexShrink: 0, background: enabled ? 'var(--c-4ade80, #4ade80)' : 'var(--c-444444, #444)', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.55 : 1, transition: 'background 0.2s' }}
            >
              <div style={{ position: 'absolute', top: 2, left: enabled ? 18 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
            </div>
          </div>
        })
      : <span style={{ color: 'var(--c-777777, #777)', fontSize: 11 }}>{empty}</span>}
  </div>
}

export default function ProviderSettings({ providerId, onProviderChange, onRefreshProvider, savedApiKeys = {}, onApiKeyConnect, providerOptions = {}, onProviderOptionsChange, models = [], defaultModel, onDefaultModelChange, defaultThinkingLevel, onDefaultThinkingLevelChange, selectedModel, onSelectedModelChange, disabled, ...ollamaProps }) {
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  // Both are about the provider whose tab is open: tagged with it rather than
  // cleared on the way out, so a key typed for one is never read as another's.
  const [keyDraft, setKeyDraft] = useState({ providerId: '', value: '' })
  const [error, setError] = useState({ providerId: '', message: '' })
  const apiKey = keyDraft.providerId === providerId ? keyDraft.value : ''
  const actionError = error.providerId === providerId ? error.message : ''
  const setApiKey = value => setKeyDraft({ providerId, value })
  const setActionError = message => setError({ providerId, message })
  // Which provider is mid-login, so switching tab drops the wait by itself.
  const [loginPending, setLoginPending] = useState('')
  const waitingForLogin = loginPending === providerId
  const native = CLI_PROVIDER_IDS.includes(providerId)
  const keyed = KEY_PROVIDER_IDS.includes(providerId)
  const hasSavedKey = Boolean(savedApiKeys[providerId])
  const keyDetails = KEY_PROVIDER_DETAILS[providerId]

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
  const connectKey = async () => {
    setBusy(true)
    setActionError('')
    try { await onApiKeyConnect?.(providerId, apiKey) } catch (error) { setActionError(error?.message || String(error)) } finally { setBusy(false) }
  }

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
      {PROVIDER_CATALOG.map(provider => <button key={provider.id} type="button" disabled={disabled} onClick={() => onProviderChange?.(provider.id)} style={{ display: 'flex', alignItems: 'center', gap: 9, textAlign: 'left', border: `1px solid ${providerId === provider.id ? 'var(--c-3f5a8a, #3f5a8a)' : 'var(--c-333333, #333)'}`, borderRadius: 7, background: providerId === provider.id ? 'var(--c-1f2a3f, #1f2a3f)' : 'var(--c-111111, #111)', color: providerId === provider.id ? 'var(--c-9fc2ff, #9fc2ff)' : 'var(--c-aaaaaa, #aaa)', padding: '10px', cursor: disabled ? 'default' : 'pointer' }}>
        <img src={provider.logo} alt="" width={16} height={16} style={{ flexShrink: 0, opacity: providerId === provider.id ? 1 : 0.7 }} />
        <span style={{ minWidth: 0 }}>
          <strong style={{ display: 'block', fontSize: 12 }}>{provider.label}</strong>
          <span style={{ fontSize: 10, color: 'var(--c-777777, #777)' }}>{provider.detail}</span>
        </span>
      </button>)}
    </div>

    {onDefaultThinkingLevelChange && <DefaultThinkingLevel providerId={providerId} value={defaultThinkingLevel} onChange={onDefaultThinkingLevelChange} disabled={disabled} />}

    {providerId === 'ollama' && <OllamaSettings {...ollamaProps} models={models} defaultModel={defaultModel} onSelectDefaultModel={onDefaultModelChange} selectedModel={selectedModel} onSelectModel={onSelectedModelChange} disabled={disabled} />}

    {keyed && <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <span style={{ color: 'var(--c-888888, #888)', fontSize: 12 }}>{keyDetails.label}</span>
        <span style={{ color: 'var(--c-666666, #666)', fontSize: 11 }}>Used with {keyDetails.origin}. In the desktop app it is encrypted with the operating system credential protection and never reaches the interface.</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="password" value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder={hasSavedKey ? 'Saved key — enter a new key to replace it' : 'Enter API key'} autoComplete="off" disabled={disabled || busy} style={{ ...fieldStyle, flex: 1, width: 'auto' }} />
          <button onClick={connectKey} disabled={disabled || busy || (!apiKey.trim() && !hasSavedKey)} style={{ background: 'var(--c-1f2a3f, #1f2a3f)', border: '1px solid var(--c-3f5a8a, #3f5a8a)', color: 'var(--c-9fc2ff, #9fc2ff)', borderRadius: 6, padding: '5px 12px' }}>{busy ? 'Connecting…' : hasSavedKey && !apiKey.trim() ? 'Refresh' : 'Connect'}</button>
        </div>
        {!!(actionError || ollamaProps.connectError) && <span style={{ color: 'var(--c-f87171, #f87171)', fontSize: 11 }}>{actionError || ollamaProps.connectError}</span>}
      </div>
      <ModelList providerId={providerId} models={models} defaultModel={defaultModel} onDefaultModelChange={onDefaultModelChange} selectedModel={selectedModel} onSelectedModelChange={onSelectedModelChange} disabledModels={ollamaProps.disabledModels} onToggleModel={ollamaProps.onToggleModel} onSetAllModelsEnabled={ollamaProps.onSetAllModelsEnabled} disabled={disabled} empty={keyDetails.empty} />
    </div>}

    {native && <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ border: '1px solid var(--c-2e2e2e, #2e2e2e)', borderRadius: 7, padding: 12, background: 'var(--c-101010, #101010)', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div><strong style={{ color: 'var(--c-dddddd, #ddd)', fontSize: 12 }}>{PROVIDER_CATALOG.find(item => item.id === providerId)?.label} client</strong><div style={{ color: status?.authenticated ? 'var(--c-4ade80, #4ade80)' : 'var(--c-888888, #888)', fontSize: 11, marginTop: 4 }}>{status?.authenticated ? 'Connected through OAuth' : status?.installed === false ? 'Client not found' : waitingForLogin ? 'Finish the login in the terminal window…' : 'Login required'}</div><small style={{ color: 'var(--c-666666, #666)' }}>AI Debate does not store or handle OAuth tokens.</small></div>
        <div style={{ display: 'flex', gap: 6 }}><button onClick={() => { void refresh().then(next => { if (next?.authenticated) onRefreshProvider?.() }) }} disabled={busy} style={{ background: 'transparent', border: '1px solid var(--c-3a3a3a, #3a3a3a)', color: 'var(--c-aaaaaa, #aaa)', borderRadius: 6, padding: '5px 9px' }}>{busy ? 'Checking…' : 'Refresh'}</button>{!status?.authenticated && <button onClick={login} disabled={busy || waitingForLogin || status?.installed === false} style={{ background: 'var(--c-1f2a3f, #1f2a3f)', border: '1px solid var(--c-3f5a8a, #3f5a8a)', color: 'var(--c-9fc2ff, #9fc2ff)', borderRadius: 6, padding: '5px 9px' }}>{waitingForLogin ? 'Waiting…' : 'Login'}</button>}</div>
      </div>
      {!!actionError && <span style={{ color: 'var(--c-f87171, #f87171)', fontSize: 11 }}>{actionError}</span>}
      <ModelList providerId={providerId} models={models} defaultModel={defaultModel} onDefaultModelChange={onDefaultModelChange} selectedModel={selectedModel} onSelectedModelChange={onSelectedModelChange} disabledModels={ollamaProps.disabledModels} onToggleModel={ollamaProps.onToggleModel} onSetAllModelsEnabled={ollamaProps.onSetAllModelsEnabled} disabled={disabled} empty={status?.authenticated ? 'Refresh to load the available models.' : 'Log in to load models.'} />
    </div>}

    <AdvancedOptions providerId={providerId} options={providerOptions} onChange={onProviderOptionsChange} disabled={disabled} />
  </div>
}
