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
    </div>
  )
}
