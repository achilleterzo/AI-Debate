import { UI_STRINGS } from '../i18n/UiStrings'

export default function ScrollToBottomButton({ onClick }) {
  const ui = UI_STRINGS.app

  return (
    <div style={{ position: 'sticky', bottom: 16, display: 'flex', justifyContent: 'center', zIndex: 4, pointerEvents: 'none' }}>
      <button
        onClick={onClick}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 44, height: 44, borderRadius: '50%',
          background: '#2a1010', border: '2px dashed #ef4444cc',
          boxShadow: 'inset 0 0 0 1px #ef444433, 0 8px 20px #000c', cursor: 'pointer',
          color: '#ef4444', pointerEvents: 'auto',
        }}
        title={ui.backToBottom}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="4,6 8,10 12,6" />
        </svg>
      </button>
    </div>
  )
}
