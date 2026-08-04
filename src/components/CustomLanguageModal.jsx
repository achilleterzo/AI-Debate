import { useState } from 'react'
import { useUiStrings } from '../i18n/UiStringsContext'

/**
 * Free-text thinking language. It is deliberately not a picker: the point of
 * the custom entry is to name languages the fixed list cannot hold — dialects,
 * historical or invented ones — so the value goes to the model as written.
 */
export default function CustomLanguageModal({ state, onClose, onConfirm }) {
  const UI_STRINGS = useUiStrings()
  const ui = UI_STRINGS.participants
  const common = UI_STRINGS.common
  const [value, setValue] = useState(state?.initialValue ?? '')

  const confirm = () => onConfirm(value)

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: '#000000bb', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
      <div onClick={event => event.stopPropagation()} style={{ background: '#141414', border: '1px solid #2e2e2e', borderRadius: 10, width: 'min(92vw, 460px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #2e2e2e' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#ddd' }}>{ui.reasoningLangCustomTitle}</span>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#666', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            value={value}
            onChange={event => setValue(event.target.value)}
            autoFocus
            spellCheck={false}
            placeholder={ui.reasoningLangCustomPlaceholder}
            onKeyDown={event => {
              if (event.key === 'Escape') onClose()
              if (event.key === 'Enter') confirm()
            }}
            style={{ width: '100%', boxSizing: 'border-box', background: '#0f0f0f', border: '1px solid #2e2e2e', borderRadius: 8, color: '#ddd', fontSize: 13, padding: '8px 10px' }}
          />
          <div style={{ fontSize: 11, color: '#777' }}>{ui.reasoningLangCustomHint}</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #3a3a3a', color: '#888', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12 }}>{common.cancel}</button>
            <button onClick={confirm} style={{ background: '#1f2a3f', border: '1px solid #3f5a8a', color: '#9fc2ff', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12 }}>{common.save}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
