import { UI_STRINGS } from '../i18n/UiStrings'
import { styles } from './Style'

export default function SummaryPanel({
  panelRef,
  streamingRole,
  contextEstimate,
  summary,
  summaryVisible,
  onToggleVisible,
  debugMode,
  summaryDebug,
  onInspectPayload,
}) {
  const ui = UI_STRINGS.app

  return (
    <div ref={panelRef} style={{
      borderBottom: '1px solid #2e2e2e',
      background: '#111',
    }}>
      <div
        role="button"
        tabIndex={0}
        onClick={onToggleVisible}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggleVisible()
          }
        }}
        style={{
          width: '100%', background: 'none', border: 'none',
          color: '#888', fontSize: 11, fontWeight: 600,
          padding: '6px 16px', cursor: 'pointer', textAlign: 'left',
          display: 'flex', alignItems: 'center', gap: 6,
          letterSpacing: 0.5, textTransform: 'uppercase',
        }}
      >
        <span style={{ color: streamingRole ? '#f97316' : '#555' }}>
          {streamingRole ? '⟳' : '◆'}
        </span>
        {ui.contextSummary}
        <span style={{ color: '#4a9eff', fontSize: 10, fontWeight: 600 }} title={ui.contextEstimate(contextEstimate.baseChars, contextEstimate.estTokens)}>
          ~{contextEstimate.estTokens} tok
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          {summary && (
            <button
              className="float-btn"
              style={{ ...styles.floatBtn(false), position: 'static', opacity: 1 }}
              title={ui.copySummary}
              onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(summary) }}
            ><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="7" height="7" rx="1"/><path d="M3 8H2a1 1 0 01-1-1V2a1 1 0 011-1h5a1 1 0 011 1v1"/></svg></button>
          )}
          {debugMode && summaryDebug?.payload && (
            <button
              className="float-btn"
              style={{ ...styles.floatBtn(false), position: 'static', opacity: 1 }}
              title={ui.inspectSummaryPayload}
              onClick={e => {
                e.stopPropagation()
                onInspectPayload()
              }}
            >⚙</button>
          )}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {summaryVisible ? <polyline points="18 15 12 9 6 15" /> : <polyline points="6 9 12 15 18 9" />}
          </svg>
        </span>
      </div>
      {summaryVisible && (
        <div style={{
          padding: '8px 16px 12px',
          fontSize: 12, color: '#aaa', lineHeight: 1.6,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          borderTop: '1px solid #1e1e1e',
        }}>
          {summary || ui.noSummary}
        </div>
      )}
    </div>
  )
}
