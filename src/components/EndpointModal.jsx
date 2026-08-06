import { useState } from 'react'
import ReactSelect from 'react-select'
import { useUiStrings } from '../i18n/UiStringsContext'
import { modelSelectStyles, styles } from './Style'

// The modal body clips its content, so the menu is portalled to the body and
// lifted above the 1100 overlay instead of being cut off inside the card.
const portalledModelSelectStyles = {
  ...modelSelectStyles,
  menuPortal: base => ({ ...base, zIndex: 1200 }),
}

/**
 * Endpoint editor, in two flavours.
 *
 * With `state.target === 'main'` it edits the general endpoint: saving connects
 * instead of closing, so the model list refreshes in place and the default
 * model can be picked from it right away. Every other target is a per-target
 * override, where an empty value means "fall back to the general endpoint".
 */
export default function EndpointModal({
  state,
  onClose,
  onConfirm,
  history = [],
  onDeleteHistoryEntry,
  models = [],
  defaultModel = '',
  onDefaultModelChange,
  connecting = false,
  connectError = null,
  ollamaOk = null,
  disabled = false,
}) {
  const UI_STRINGS = useUiStrings()
  const ui = UI_STRINGS.endpointModal
  const appUi = UI_STRINGS.app
  const common = UI_STRINGS.common
  const [value, setValue] = useState(state?.initialValue ?? '')

  const isMain = state?.target === 'main'
  const unreachable = ollamaOk === false
  const suggestions = history.filter(entry => entry !== value.trim())

  const cloud = models.filter(entry => entry.endsWith('cloud')).sort()
  const local = models.filter(entry => !entry.endsWith('cloud')).sort()
  const modelOptions = [
    ...(cloud.length ? [{ label: common.cloud, options: cloud.map(entry => ({ value: entry, label: entry })) }] : []),
    ...(local.length ? [{ label: common.local, options: local.map(entry => ({ value: entry, label: entry })) }] : []),
  ]

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: '#000000bb', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#141414', border: '1px solid #2e2e2e', borderRadius: 10, width: 'min(92vw, 560px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #2e2e2e' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#ddd' }}>{isMain ? ui.mainTitle : ui.title}</span>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#666', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ position: 'relative' }}>
            <input
              value={value}
              onChange={e => setValue(e.target.value)}
              autoFocus
              placeholder="http://localhost:11434"
              spellCheck={false}
              disabled={disabled || connecting}
              onKeyDown={e => {
                if (e.key === 'Escape') onClose()
                if (e.key === 'Enter') onConfirm(value)
              }}
              style={{ width: '100%', boxSizing: 'border-box', background: '#0f0f0f', border: `1px solid ${connectError && isMain ? '#7f3f3f' : '#2e2e2e'}`, borderRadius: 8, color: '#ddd', fontSize: 13, padding: '8px 34px 8px 10px' }}
            />
            {!!value.trim() && (
              <button
                onClick={() => setValue('')}
                title={ui.clearTitle}
                style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  width: 18, height: 18, borderRadius: '50%',
                  border: '1px solid #3a3a3a', background: '#191919', color: '#888',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', fontSize: 11, lineHeight: 1, padding: 0,
                }}
              >✕</button>
            )}
          </div>
          {suggestions.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 11, color: '#777' }}>{ui.history}</span>
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
                      style={{
                        background: 'none', border: 'none', color: 'inherit', cursor: 'pointer',
                        padding: 0, fontSize: 11, maxWidth: 320,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}
                    >{entry}</button>
                    <button
                      onClick={() => onDeleteHistoryEntry?.(entry)}
                      title={ui.removeFromHistory}
                      style={{ background: 'none', border: 'none', color: '#5c7fa3', cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: 0 }}
                    >✕</button>
                  </span>
                ))}
              </div>
            </div>
          )}
          {isMain ? (
            <>
              {/* "Failed to fetch" is what the browser says and it explains
                  nothing, so unreachable gets its own translated line and the
                  raw error is demoted to the detail underneath it. */}
              <div style={{ display: 'flex', gap: 6, minHeight: 16 }}>
                <span style={{ ...styles.dot(connecting ? null : ollamaOk), marginTop: 3 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 11, color: unreachable || connectError ? '#f87171' : '#888' }}>
                    {connecting
                      ? appUi.connectionConnecting
                      : unreachable
                        ? ui.unreachableHint
                        : connectError
                          ? connectError
                          : appUi.connectionConnected(models.length)}
                  </span>
                  {!connecting && unreachable && !!connectError && (
                    <span style={{ fontSize: 10, color: '#777' }}>{connectError}</span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span style={{ fontSize: 11, color: '#777' }} title={appUi.defaultModelTitle}>{appUi.defaultModel}</span>
                <ReactSelect
                  styles={portalledModelSelectStyles}
                  menuPortalTarget={document.body}
                  options={modelOptions}
                  value={defaultModel ? { value: defaultModel, label: defaultModel } : null}
                  onChange={opt => onDefaultModelChange?.(opt?.value ?? '')}
                  placeholder={common.chooseModel}
                  isClearable
                  isDisabled={disabled}
                  menuPlacement="auto"
                  noOptionsMessage={() => common.noModels}
                />
              </div>
            </>
          ) : (
            <div style={{ fontSize: 11, color: '#777' }}>{ui.emptyHint}</div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #3a3a3a', color: '#888', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12 }}>{isMain ? common.close : common.cancel}</button>
            <button
              onClick={() => onConfirm(value)}
              disabled={isMain && (connecting || disabled)}
              style={{ background: '#1f2a3f', border: '1px solid #3f5a8a', color: '#9fc2ff', borderRadius: 6, padding: '5px 12px', cursor: isMain && connecting ? 'wait' : 'pointer', fontSize: 12, opacity: isMain && (connecting || disabled) ? 0.6 : 1 }}
            >{isMain ? (connecting ? appUi.connecting : appUi.connect) : common.save}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
