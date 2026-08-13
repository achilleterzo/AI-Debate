import { useState } from 'react'
import { useUiStrings } from '../i18n/UiStringsContext'
import { styles } from './Style'

/**
 * The Ollama tab of the settings modal: which server the app talks to, and
 * which of the models it serves are allowed through.
 *
 * The models are a list of switches rather than a picker on purpose — this is
 * where the catalogue is curated, not where a model is chosen for a turn. An
 * endpoint commonly serves dozens of models, most of them irrelevant to a
 * debate, and every one of them used to land in every select.
 */
export default function OllamaSettings({
  endpoint = '',
  onConnect,
  connecting = false,
  connectError = null,
  ollamaOk = null,
  history = [],
  onDeleteHistoryEntry,
  models = [],
  disabledModels = [],
  onToggleModel,
  onSetAllModelsEnabled,
  defaultModel = '',
  onSelectDefaultModel,
  disabled = false,
}) {
  const UI_STRINGS = useUiStrings()
  const ui = UI_STRINGS.promptSettingsModal
  const appUi = UI_STRINGS.app
  const common = UI_STRINGS.common
  const endpointUi = UI_STRINGS.endpointModal
  const [value, setValue] = useState(endpoint)

  const unreachable = ollamaOk === false
  const suggestions = history.filter(entry => entry !== value.trim())

  const disabledSet = new Set(disabledModels)
  const enabledCount = models.filter(model => !disabledSet.has(model)).length
  const cloud = models.filter(model => model.endsWith('cloud')).sort()
  const local = models.filter(model => !model.endsWith('cloud')).sort()
  const groups = [
    ...(cloud.length ? [{ label: common.cloud, models: cloud }] : []),
    ...(local.length ? [{ label: common.local, models: local }] : []),
  ]

  const renderRow = (model) => {
    const enabled = !disabledSet.has(model)
    const isDefault = model === defaultModel
    return (
      <div
        key={model}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          border: `1px solid ${isDefault ? '#3f5a8a' : '#252525'}`, borderRadius: 7, background: '#101010', padding: '7px 9px',
          opacity: disabled ? 0.55 : 1,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {/* A model switched off cannot hold the default, so its radio goes
              with it — picking one would contradict the toggle next to it. */}
          <input
            type="radio"
            name="ollamaDefaultModel"
            checked={isDefault}
            onChange={() => onSelectDefaultModel?.(model)}
            disabled={disabled || !enabled}
            title={ui.ollamaDefaultRadio}
            aria-label={`${ui.ollamaDefaultRadio}: ${model}`}
            style={{ width: 13, height: 13, margin: 0, flexShrink: 0, accentColor: '#3f5a8a', cursor: disabled || !enabled ? 'default' : 'pointer' }}
          />
          <span style={{ fontSize: 12, color: enabled ? (isDefault ? '#9fc2ff' : '#ccc') : '#666', fontFamily: 'var(--mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{model}</span>
          {isDefault && (
            <span style={{ fontSize: 10, color: '#9fc2ff', border: '1px solid #3f5a8a', borderRadius: 999, padding: '1px 6px', whiteSpace: 'nowrap', flexShrink: 0 }}>{ui.ollamaDefaultBadge}</span>
          )}
        </div>
        <div
          onClick={() => !disabled && onToggleModel?.(model, !enabled)}
          role="switch"
          aria-checked={enabled}
          aria-label={model}
          title={enabled ? ui.toolEnabled : ui.toolDisabled}
          style={{ width: 34, height: 18, borderRadius: 9, position: 'relative', flexShrink: 0, background: enabled ? '#4ade80' : '#444', cursor: disabled ? 'default' : 'pointer', transition: 'background 0.2s' }}
        >
          <div style={{ position: 'absolute', top: 2, left: enabled ? 18 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 12, color: '#888' }}>{ui.ollamaEndpointTitle}</span>
        <span style={{ fontSize: 11, color: '#666', lineHeight: 1.45 }}>{ui.ollamaEndpointDescription}</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="http://localhost:11434"
            spellCheck={false}
            disabled={disabled || connecting}
            onKeyDown={e => { if (e.key === 'Enter' && value.trim()) onConnect?.(value) }}
            style={{ flex: 1, minWidth: 0, boxSizing: 'border-box', background: '#0f0f0f', border: `1px solid ${connectError ? '#7f3f3f' : '#2e2e2e'}`, borderRadius: 6, color: '#ddd', fontSize: 12, padding: '6px 9px' }}
          />
          <button
            onClick={() => onConnect?.(value)}
            disabled={disabled || connecting || !value.trim()}
            style={{ background: '#1f2a3f', border: '1px solid #3f5a8a', color: '#9fc2ff', borderRadius: 6, padding: '5px 12px', fontSize: 12, flexShrink: 0, cursor: connecting ? 'wait' : 'pointer', opacity: disabled || connecting || !value.trim() ? 0.6 : 1 }}
          >{connecting ? appUi.connecting : appUi.connect}</button>
        </div>

        {/* "Failed to fetch" is what the browser says and it explains nothing,
            so unreachable gets its own translated line and the raw error is
            demoted to the detail underneath it. */}
        <div style={{ display: 'flex', gap: 6, minHeight: 16 }}>
          <span style={{ ...styles.dot(connecting ? null : ollamaOk), marginTop: 3 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 11, color: unreachable || connectError ? '#f87171' : '#888' }}>
              {connecting
                ? appUi.connectionConnecting
                : unreachable
                  ? endpointUi.unreachableHint
                  : connectError
                    ? connectError
                    : appUi.connectionConnected(enabledCount)}
            </span>
            {!connecting && unreachable && !!connectError && (
              <span style={{ fontSize: 10, color: '#777' }}>{connectError}</span>
            )}
          </div>
        </div>

        {suggestions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 11, color: '#777' }}>{endpointUi.history}</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {suggestions.map(entry => (
                <span
                  key={entry}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: '#152131', border: '1px solid #2f4f6f', borderRadius: 6,
                    padding: '2px 4px 2px 8px', fontSize: 11, color: '#9ac8ff', maxWidth: '100%',
                  }}
                >
                  <button
                    onClick={() => setValue(entry)}
                    title={entry}
                    style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, fontSize: 11, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >{entry}</button>
                  <button
                    onClick={() => onDeleteHistoryEntry?.(entry)}
                    title={endpointUi.removeFromHistory}
                    style={{ background: 'none', border: 'none', color: '#5c7fa3', cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: 0 }}
                  >✕</button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid #242424', paddingTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#888' }}>{ui.ollamaModelsTitle}</span>
          {models.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: '#666' }}>{ui.ollamaModelsCount(enabledCount, models.length)}</span>
              <button
                onClick={() => !disabled && onSetAllModelsEnabled?.(true)}
                style={{ background: 'transparent', border: '1px solid #3a3a3a', color: '#888', borderRadius: 6, padding: '3px 9px', fontSize: 11, cursor: disabled ? 'default' : 'pointer' }}
              >{ui.ollamaEnableAll}</button>
              <button
                onClick={() => !disabled && onSetAllModelsEnabled?.(false)}
                style={{ background: 'transparent', border: '1px solid #3a3a3a', color: '#888', borderRadius: 6, padding: '3px 9px', fontSize: 11, cursor: disabled ? 'default' : 'pointer' }}
              >{ui.ollamaDisableAll}</button>
            </div>
          )}
        </div>
        <span style={{ fontSize: 11, color: '#666', lineHeight: 1.45 }}>{ui.ollamaModelsDescription}</span>

        {models.length === 0 ? (
          <span style={{ fontSize: 11, color: '#777' }}>{ui.ollamaNoModels}</span>
        ) : (
          groups.map(group => (
            <div key={group.label} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: 0.6 }}>{group.label}</span>
              {group.models.map(renderRow)}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
