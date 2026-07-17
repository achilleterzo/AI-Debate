import { UI_STRINGS } from '../i18n/UiStrings'

export default function SummaryProgressBadge() {
  const ui = UI_STRINGS.app

  return (
    <div style={{ textAlign: 'center', margin: '8px 16px' }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 10,
        background: '#111820', border: '1px solid #4a9eff33',
        borderRadius: 20, padding: '8px 18px',
        fontSize: 12, color: '#4a9eff', opacity: 0.85,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4a9eff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, animation: 'spin 1s linear infinite' }}>
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
        <span>{ui.summaryProcessing}</span>
      </div>
    </div>
  )
}
