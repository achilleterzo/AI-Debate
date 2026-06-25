import { useState } from 'react'
import { UI_STRINGS } from '../i18n/UiStrings'

export default function EndpointModal({ state, onClose, onConfirm }) {
  const ui = UI_STRINGS.endpointModal
  const common = UI_STRINGS.common
  const [value, setValue] = useState(state?.initialValue ?? '')

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: '#000000bb', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#141414', border: '1px solid #2e2e2e', borderRadius: 10, width: 'min(92vw, 560px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #2e2e2e' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#ddd' }}>{ui.title}</span>
            <span style={{ fontSize: 11, color: '#777' }}>{state?.participantLabel || ''}</span>
          </div>
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
              onKeyDown={e => {
                if (e.key === 'Escape') onClose()
                if (e.key === 'Enter') onConfirm(value)
              }}
              style={{ width: '100%', boxSizing: 'border-box', background: '#0f0f0f', border: '1px solid #2e2e2e', borderRadius: 8, color: '#ddd', fontSize: 13, padding: '8px 34px 8px 10px' }}
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
          <div style={{ fontSize: 11, color: '#777' }}>{ui.emptyHint}</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #3a3a3a', color: '#888', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12 }}>{common.cancel}</button>
            <button onClick={() => onConfirm(value)} style={{ background: '#1f2a3f', border: '1px solid #3f5a8a', color: '#9fc2ff', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12 }}>{common.save}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
