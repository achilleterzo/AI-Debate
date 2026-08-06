import { useUiStrings } from '../i18n/UiStringsContext'
import { styles } from './Style'

/**
 * Debate mode picker. Endpoint and default model live in the connection modal,
 * the session language rides along with the summary row, so the mode is what
 * is left of the old connection panel.
 */
export default function DebateModeSettings({
  disabled,
  debateMode,
  onDebateModeChange,
  debateModeOptions = [],
}) {
  const UI_STRINGS = useUiStrings()
  const common = UI_STRINGS.common
  const modeLabels = UI_STRINGS.modes

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={styles.endpointLabel}>{common.debateMode}</span>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {debateModeOptions.map(option => {
          const active = option.value === debateMode
          const label = modeLabels?.[option.value] ?? option.label
          return <button key={option.value} type="button" disabled={disabled} onClick={() => onDebateModeChange(option.value)} title={label} style={{ background: active ? '#263b5c' : '#151515', border: `1px solid ${active ? '#628dd1' : '#303030'}`, color: active ? '#c5dcff' : '#999', borderRadius: 999, padding: '4px 9px', fontSize: 11, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.65 : 1 }}>{label}</button>
        })}
      </div>
    </div>
  )
}
