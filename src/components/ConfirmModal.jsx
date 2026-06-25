import { UI_STRINGS } from '../i18n/UiStrings'

export default function ConfirmModal({ state, onCancel, onConfirm }) {
  const common = UI_STRINGS.common
  const ui = UI_STRINGS.confirmModal

  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: '#000000bb', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#141414', border: '1px solid #2e2e2e', borderRadius: 10, width: 'min(92vw, 460px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '12px 14px 6px', fontSize: 14, fontWeight: 700, color: '#ddd' }}>{state.title}</div>
        <div style={{ padding: '0 14px 14px', fontSize: 13, color: '#999', lineHeight: 1.55 }}>{state.message}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '10px 14px', borderTop: '1px solid #2e2e2e' }}>
          <button onClick={onCancel} style={{ background: 'transparent', border: '1px solid #3a3a3a', color: '#888', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12 }}>{common.cancel}</button>
          <button
            onClick={onConfirm}
            style={{
              background: state.danger ? '#3a1e1e' : '#1f2a3f',
              border: `1px solid ${state.danger ? '#7a3b3b' : '#3f5a8a'}`,
              color: state.danger ? '#fca5a5' : '#9fc2ff',
              borderRadius: 6,
              padding: '5px 12px',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            {state.confirmLabel || ui.defaultConfirm}
          </button>
        </div>
      </div>
    </div>
  )
}
