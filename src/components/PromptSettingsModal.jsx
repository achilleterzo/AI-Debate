import { useState } from 'react'
import { UI_STRINGS } from '../i18n/UiStrings'

export default function PromptSettingsModal({ value, onClose, onSave, onReset }) {
  const ui = UI_STRINGS.promptSettingsModal
  const common = UI_STRINGS.common
  const [text, setText] = useState(value)

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: '#000000bb', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#141414', border: '1px solid #2e2e2e', borderRadius: 10, width: 'min(94vw, 720px)', maxHeight: '84vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #2e2e2e' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#ddd' }}>{ui.title}</span>
            <span style={{ fontSize: 11, color: '#777' }}>{ui.description}</span>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#666', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={14}
            spellCheck={false}
            style={{ width: '100%', boxSizing: 'border-box', background: '#0f0f0f', border: '1px solid #2e2e2e', borderRadius: 8, color: '#ddd', fontSize: 12, lineHeight: 1.55, padding: '10px 12px', resize: 'vertical', minHeight: 220 }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '10px 14px', borderTop: '1px solid #2e2e2e' }}>
          <button onClick={() => setText(onReset())} style={{ background: 'transparent', border: '1px solid #3a3a3a', color: '#888', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12 }}>{ui.resetDefault}</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #3a3a3a', color: '#888', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12 }}>{common.cancel}</button>
            <button onClick={() => onSave(text)} style={{ background: '#1f2a3f', border: '1px solid #3f5a8a', color: '#9fc2ff', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12 }}>{common.save}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
