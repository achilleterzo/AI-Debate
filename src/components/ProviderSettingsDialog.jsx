import ProviderSettings from './ProviderSettings'

export default function ProviderSettingsDialog({ onClose, title = 'AI Providers', ...providerProps }) {
  return <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: '#000000bb', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
    <div onClick={event => event.stopPropagation()} style={{ background: '#141414', border: '1px solid #2e2e2e', borderRadius: 10, width: 'min(94vw, 720px)', maxHeight: 'min(88vh, 680px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #2e2e2e', flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#ddd' }}>{title}</span>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#666', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>✕</button>
      </div>
      <div style={{ padding: 14, overflowY: 'auto' }}>
        <ProviderSettings {...providerProps} />
      </div>
    </div>
  </div>
}
