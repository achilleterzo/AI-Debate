import { useUiStrings } from '../i18n/UiStringsContext'

/**
 * Round limit shown as a single control next to the topic bar: the label and
 * the number share one bordered box, so it reads as one field rather than a
 * loose label plus input.
 */
export default function RoundsInput({ maxTurns, onMaxTurnsChange, running }) {
  const ui = useUiStrings().app

  return (
    <div
      title={`${ui.round} — 0 = ∞`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        height: 44,
        padding: '0 10px',
        background: '#161616',
        border: '1px solid #2e2e2e',
        borderRadius: 8,
        flexShrink: 0,
        opacity: running ? 0.5 : 1,
      }}
    >
      <span style={{ fontSize: 11, color: '#666', whiteSpace: 'nowrap', userSelect: 'none' }}>{ui.round}</span>
      <button
        type="button"
        onClick={() => onMaxTurnsChange(Math.max(0, maxTurns - 1))}
        disabled={running || maxTurns <= 0}
        title={`${ui.round} − 1`}
        aria-label={`${ui.round} − 1`}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 20, height: 26, padding: 0,
          background: 'transparent', border: 'none', borderRadius: 4,
          color: running || maxTurns <= 0 ? '#3a3a3a' : '#888',
          cursor: running || maxTurns <= 0 ? 'default' : 'pointer',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M7.5 2.5 4 6l3.5 3.5" />
        </svg>
      </button>
      <input
        type="number"
        min={0}
        value={maxTurns}
        onChange={event => onMaxTurnsChange(Math.max(0, Number(event.target.value)))}
        disabled={running}
        style={{
          width: 34,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: '#e0e0e0',
          fontSize: 13,
          textAlign: 'center',
          padding: 0,
          fontFamily: 'inherit',
        }}
      />
      <button
        type="button"
        onClick={() => onMaxTurnsChange(maxTurns + 1)}
        disabled={running}
        title={`${ui.round} + 1`}
        aria-label={`${ui.round} + 1`}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 20, height: 26, padding: 0,
          background: 'transparent', border: 'none', borderRadius: 4,
          color: running ? '#3a3a3a' : '#888',
          cursor: running ? 'default' : 'pointer',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m4.5 2.5 3.5 3.5-3.5 3.5" />
        </svg>
      </button>
    </div>
  )
}
