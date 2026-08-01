import ReactSelect from 'react-select'
import { UI_LANGUAGE_OPTIONS, formatLanguageLabel } from '../i18n/UiStrings'
import { useUiStrings } from '../i18n/UiStringsContext'
import { styles } from './Style'

export default function ConnectionSettings({
  uiLang,
  onUiLangChange,
  endpointInput,
  onEndpointChange,
  onConnect,
  connecting,
  connectError,
  disabled,
  models = [],
  modelSelectStyles,
  moodSelectStyles,
  defaultModel,
  onDefaultModelChange,
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
        <span style={styles.endpointLabel}>{ui.endpoint}</span>
        <input style={connectError ? styles.endpointInputErr : styles.endpointInput} value={endpointInput} onChange={event => onEndpointChange(event.target.value)} onKeyDown={event => event.key === 'Enter' && onConnect()} placeholder="http://localhost:11434" disabled={connecting || disabled} spellCheck={false} />
        <button style={styles.connectBtn(connecting)} onClick={onConnect} disabled={connecting || disabled}>{connecting ? ui.connecting : ui.connect}</button>
        {connectError && <span style={styles.errText}>{connectError}</span>}
      </div>
      <div style={styles.endpointRow}>
        <span style={styles.endpointLabel}>{ui.defaultModel}</span>
        <div style={{ flex: 1, minWidth: 160 }}>
          <ReactSelect
            styles={modelSelectStyles}
            options={(() => {
              const cloud = models.filter(m => m.endsWith('cloud')).sort()
              const local = models.filter(m => !m.endsWith('cloud')).sort()
              return [
                ...(cloud.length ? [{ label: common.cloud, options: cloud.map(m => ({ value: m, label: m })) }] : []),
                ...(local.length ? [{ label: common.local, options: local.map(m => ({ value: m, label: m })) }] : []),
              ]
            })()}
            value={defaultModel ? { value: defaultModel, label: defaultModel } : null}
            onChange={opt => onDefaultModelChange(opt?.value ?? '')}
            placeholder={common.chooseModel}
            isClearable
            isDisabled={disabled}
            menuPlacement="auto"
            noOptionsMessage={() => common.noModels}
            title={ui.defaultModelTitle}
          />
        </div>
        <span style={{ ...styles.endpointLabel, marginLeft: 8 }}>{ui.language}</span>
        <div style={{ minWidth: 170 }}>
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
