import { UI_STRINGS } from '../i18n/UiStrings'

export default function PayloadModal({ payload, onClose }) {
  const ui = UI_STRINGS.payloadModal
  const json = JSON.stringify(payload, null, 2)

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: '#000000bb',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#141414', border: '1px solid #2e2e2e', borderRadius: 10,
          width: '70vw', maxWidth: 820, maxHeight: '80vh',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid #2e2e2e' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#aaa', letterSpacing: 0.5 }}>{ui.title}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => navigator.clipboard.writeText(json)}
              style={{ background: '#1e1e1e', border: '1px solid #333', borderRadius: 5, color: '#aaa', fontSize: 12, padding: '3px 10px', cursor: 'pointer' }}
            ><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="7" height="7" rx="1"/><path d="M3 8H2a1 1 0 01-1-1V2a1 1 0 011-1h5a1 1 0 011 1v1"/></svg> {ui.copy}</button>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#666', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>✕</button>
          </div>
        </div>
        <pre style={{
          flex: 1, overflowY: 'auto', margin: 0,
          padding: '14px 16px', fontSize: 12, lineHeight: 1.6,
          color: '#c9d1d9', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>{json}</pre>
      </div>
    </div>
  )
}
