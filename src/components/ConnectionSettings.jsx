import ReactSelect from 'react-select'
import { UI_LANGUAGE_OPTIONS, formatLanguageLabel } from '../i18n/UiStrings'
import { useUiStrings } from '../i18n/UiStringsContext'
import { styles } from './Style'

/**
 * Session settings. Endpoint and default model live in the connection modal
 * reached from the status light in the header, so what stays here is what
 * belongs to the current chat: its output language and its debate mode.
 */
export default function ConnectionSettings({
  uiLang,
  onUiLangChange,
  disabled,
  moodSelectStyles,
  debateMode,
  onDebateModeChange,
  debateModeOptions = [],
}) {
  const UI_STRINGS = useUiStrings()
  const ui = UI_STRINGS.app
  const common = UI_STRINGS.common
  const modeLabels = UI_STRINGS.modes
  const languageOptions = UI_LANGUAGE_OPTIONS.map(language => ({ value: language.code, label: language.label, code: language.code }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={styles.endpointRow}>
        <span style={styles.endpointLabel}>{ui.language}</span>
        <div style={{ flex: 1, minWidth: 170 }}>
          <ReactSelect
            styles={moodSelectStyles}
            options={languageOptions}
            value={languageOptions.find(o => o.value === uiLang) ?? null}
            onChange={opt => onUiLangChange(opt.value)}
            formatOptionLabel={formatLanguageLabel}
            isDisabled={disabled}
            menuPlacement="auto"
          />
        </div>
      </div>
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
    </div>
  )
}
