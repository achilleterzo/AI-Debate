import { UI_LANGUAGE_OPTIONS, UI_STRINGS } from '../i18n/UiStrings'
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
}) {
  const ui = UI_STRINGS.app

  return (
    <div style={styles.endpointRow}>
      <span style={styles.endpointLabel}>{ui.language}</span>
      <select value={uiLang} onChange={event => onUiLangChange(event.target.value)} disabled={disabled} style={{ background: '#1a1a1a', color: '#ccc', border: '1px solid #333', borderRadius: 6, padding: '4px 8px', fontSize: 12, cursor: disabled ? 'not-allowed' : 'pointer' }}>
        {UI_LANGUAGE_OPTIONS.map(language => <option key={language.code} value={language.code}>{language.label}</option>)}
      </select>
      <span style={{ ...styles.endpointLabel, marginLeft: 8 }}>{ui.endpoint}</span>
      <input style={connectError ? styles.endpointInputErr : styles.endpointInput} value={endpointInput} onChange={event => onEndpointChange(event.target.value)} onKeyDown={event => event.key === 'Enter' && onConnect()} placeholder="http://localhost:11434" disabled={connecting || disabled} spellCheck={false} />
      <button style={styles.connectBtn(connecting)} onClick={onConnect} disabled={connecting || disabled}>{connecting ? ui.connecting : ui.connect}</button>
      {connectError && <span style={styles.errText}>{connectError}</span>}
    </div>
  )
}
