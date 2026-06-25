import { useState } from 'react'
import ReactSelect from 'react-select'
import { UI_STRINGS } from '../i18n/UiStrings'

export default function ConstraintModal({ state, onClose, onConfirm, globalSuggestions = [], selectStyles, onDeleteGlobalSuggestion }) {
  const ui = UI_STRINGS.constraintModal
  const common = UI_STRINGS.common
  const [text, setText] = useState(state?.initialText ?? '')
  const isDelete = state?.mode === 'delete'
  const title = isDelete ? ui.removeTitle : state?.mode === 'edit' ? ui.editTitle : ui.newTitle
  const subtitle = state?.scope === 'global' ? ui.globalSubtitle : ui.participantSubtitle(state?.participantTag ?? '')

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: '#000000bb', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#141414', border: '1px solid #2e2e2e', borderRadius: 10, width: 'min(92vw, 560px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #2e2e2e' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#cfcfcf' }}>{title}</span>
            <span style={{ fontSize: 11, color: '#777' }}>{subtitle}</span>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#666', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {isDelete ? (
            <div style={{ fontSize: 13, color: '#aaa', lineHeight: 1.5 }}>
              {ui.confirmRemove}
              <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 6, border: '1px solid #2e2e2e', background: '#101010', color: '#d5d5d5' }}>{state?.initialText || ''}</div>
            </div>
          ) : (
            <>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                autoFocus
                rows={4}
                onKeyDown={e => {
                  if (e.key === 'Escape') onClose()
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault()
                    onConfirm(text)
                  }
                }}
                placeholder={ui.placeholder}
                style={{ width: '100%', boxSizing: 'border-box', background: '#0f0f0f', border: '1px solid #2e2e2e', borderRadius: 8, color: '#ddd', fontSize: 13, lineHeight: 1.55, padding: '8px 10px', resize: 'vertical', minHeight: 92 }}
              />
              {state?.scope === 'global' && globalSuggestions.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 11, color: '#888' }}>{ui.history}</div>
                  <div>
                    <ReactSelect
                      styles={selectStyles}
                      options={globalSuggestions.map((item, i) => ({ value: String(i), label: item }))}
                      onChange={opt => {
                        const idx = Number(opt?.value)
                        if (Number.isFinite(idx) && globalSuggestions[idx]) setText(globalSuggestions[idx])
                      }}
                      formatOptionLabel={(opt) => (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{
                            flex: 1,
                            display: 'inline-flex', alignItems: 'center',
                            background: '#1f1726', border: '1px solid #4a2f63', borderRadius: 999,
                            color: '#caa9ee', fontSize: 11, lineHeight: 1.2, padding: '3px 8px',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }} title={opt.label}>{opt.label}</span>
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              if (typeof onDeleteGlobalSuggestion === 'function') {
                                const idx = Number(opt.value)
                                if (Number.isFinite(idx)) onDeleteGlobalSuggestion(idx)
                              }
                            }}
                            title={ui.removeFromHistory}
                            style={{ background: 'none', border: 'none', color: '#7f629d', cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: 0 }}
                          >✕</button>
                        </div>
                      )}
                      placeholder={ui.selectSaved}
                      isClearable
                      menuPlacement="top"
                      noOptionsMessage={() => ui.noConstraints}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #3a3a3a', color: '#888', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12 }}>{common.cancel}</button>
            <button
              onClick={() => onConfirm(text)}
              style={{
                background: isDelete ? '#3a1e1e' : '#1f2a3f',
                border: `1px solid ${isDelete ? '#7a3b3b' : '#3f5a8a'}`,
                color: isDelete ? '#fca5a5' : '#9fc2ff',
                borderRadius: 6,
                padding: '5px 12px',
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              {isDelete ? common.remove : common.save}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
