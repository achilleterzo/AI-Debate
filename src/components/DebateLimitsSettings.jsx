import { UI_STRINGS } from '../i18n/UiStrings'
import { styles } from './Style'

export default function DebateLimitsSettings({
  maxTurns,
  onMaxTurnsChange,
  timeoutSec,
  onTimeoutSecChange,
  recentK,
  onRecentKChange,
  useSummary,
  debugMode,
  onDebugModeChange,
  running,
}) {
  const ui = UI_STRINGS.app

  return (
    <div style={{ ...styles.controlRow, flexWrap: 'wrap' }}>
      <span style={styles.label}>{ui.round}</span>
      <input
        type="number" min={0} style={styles.numInput}
        value={maxTurns}
        onChange={e => onMaxTurnsChange(Number(e.target.value))}
        disabled={running}
      />
      <span style={styles.hint}>(0 = ∞)</span>
      <span style={{ ...styles.label, marginLeft: 8 }}>{ui.timeout}</span>
      <input
        type="number" min={10} max={600} style={styles.numInput}
        value={timeoutSec}
        onChange={e => onTimeoutSecChange(Math.max(10, Number(e.target.value)))}
        disabled={running}
      />
      <span style={styles.hint}>{ui.seconds}</span>
      <span style={{ ...styles.label, marginLeft: 8, opacity: useSummary ? 0.4 : 1 }}>{ui.lastK}</span>
      <input
        type="number" min={0} max={20} style={{ ...styles.numInput, opacity: useSummary ? 0.4 : 1 }}
        value={recentK}
        onChange={e => onRecentKChange(Math.max(0, Number(e.target.value)))}
        disabled={running || useSummary}
      />
      <div
        onClick={() => onDebugModeChange(!debugMode)}
        title={debugMode ? ui.debugOn : ui.debugOff}
        style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', cursor: 'pointer', userSelect: 'none' }}
      >
        <div style={{ width: 32, height: 16, borderRadius: 8, position: 'relative', background: debugMode ? '#f59e0b' : '#444', transition: 'background 0.2s' }}>
          <div style={{ position: 'absolute', top: 2, left: debugMode ? 18 : 2, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
        </div>
        <span style={{ fontSize: 12, color: debugMode ? '#f59e0b' : '#aaa' }}>{ui.debugLabel}</span>
      </div>
    </div>
  )
}
