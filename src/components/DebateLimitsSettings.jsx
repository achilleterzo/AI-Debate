import { useUiStrings } from '../i18n/UiStringsContext'
import { styles } from './Style'

export default function DebateLimitsSettings({
  debugMode,
  onDebugModeChange,
}) {
  const UI_STRINGS = useUiStrings()
  const ui = UI_STRINGS.app

  return (
    <div style={{ ...styles.controlRow, flexWrap: 'wrap' }}>
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
