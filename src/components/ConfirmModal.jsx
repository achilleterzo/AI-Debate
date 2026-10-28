import { useUiStrings } from '../i18n/UiStringsContext'

export default function ConfirmModal({ state, onCancel, onConfirm }) {
  const UI_STRINGS = useUiStrings()
  const common = UI_STRINGS.common
  const ui = UI_STRINGS.confirmModal

  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'var(--c-000000bb, #000000bb)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--c-141414, #141414)', border: '1px solid var(--c-2e2e2e, #2e2e2e)', borderRadius: 10, width: 'min(92vw, 460px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '12px 14px 6px', fontSize: 14, fontWeight: 700, color: 'var(--c-dddddd, #ddd)' }}>{state.title}</div>
        <div style={{ padding: '0 14px 14px', fontSize: 13, color: 'var(--c-999999, #999)', lineHeight: 1.55 }}>{state.message}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '10px 14px', borderTop: '1px solid var(--c-2e2e2e, #2e2e2e)', flexWrap: 'wrap' }}>
          <button onClick={onCancel} style={{ background: 'transparent', border: '1px solid var(--c-3a3a3a, #3a3a3a)', color: 'var(--c-888888, #888)', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12 }}>{common.cancel}</button>
          {(state.options || [{ label: state.confirmLabel || ui.defaultConfirm, danger: state.danger }]).map((option, index) => (
            <button
              key={option.label || index}
              onClick={() => onConfirm(option)}
              style={{
                background: option.danger ? 'var(--c-3a1e1e, #3a1e1e)' : 'var(--c-1f2a3f, #1f2a3f)',
                border: `1px solid ${option.danger ? 'var(--c-7a3b3b, #7a3b3b)' : 'var(--c-3f5a8a, #3f5a8a)'}`,
                color: option.danger ? 'var(--c-fca5a5, #fca5a5)' : 'var(--c-9fc2ff, #9fc2ff)',
                borderRadius: 6,
                padding: '5px 12px',
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
