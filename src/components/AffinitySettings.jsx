import { MODERATION_COOLING_STEPS } from '../settings/Settings'
import { useUiStrings } from '../i18n/UiStringsContext'
import { styles } from './Style'

export default function AffinitySettings({ dynamicAffinity, onDynamicAffinityChange, moderationCooling, onModerationCoolingChange, running }) {
  const UI_STRINGS = useUiStrings()
  const ui = UI_STRINGS.app

  return (
    <div style={{ ...styles.settingsRow, flexWrap: 'wrap' }}>
      <div
        onClick={() => !running && onDynamicAffinityChange(!dynamicAffinity)}
        title={dynamicAffinity ? ui.dynamicAffinityTitleOn : ui.dynamicAffinityTitleOff}
        style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: running ? 'default' : 'pointer', userSelect: 'none', opacity: running ? 0.5 : 1 }}
      >
        <div style={{ width: 32, height: 16, borderRadius: 8, position: 'relative', background: dynamicAffinity ? '#22d3ee' : '#444', transition: 'background 0.2s', flexShrink: 0 }}>
          <div style={{ position: 'absolute', top: 2, left: dynamicAffinity ? 18 : 2, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
        </div>
        <span style={{ fontSize: 12, color: dynamicAffinity ? '#22d3ee' : '#666', whiteSpace: 'nowrap' }}>{ui.dynamicAffinity}</span>
      </div>
      {dynamicAffinity && (
        <>
        <div style={{ width: 1, height: 18, background: '#2e2e2e', flexShrink: 0 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} title={ui.coolingTitle}>
          <span style={{ fontSize: 12, color: '#6aa7b5', whiteSpace: 'nowrap' }}>{ui.cooling}</span>
          <div style={{ display: 'flex', gap: 3 }}>
            {MODERATION_COOLING_STEPS.map(v => {
              const active = Math.abs(moderationCooling - v) < 0.0001
              return (
                <button
                  key={String(v)}
                  disabled={running}
                  onClick={() => onModerationCoolingChange(v)}
                  style={{
                    fontSize: 10, padding: '2px 6px', borderRadius: 4, border: '1px solid',
                    cursor: running ? 'default' : 'pointer',
                    background: active ? '#0f3640' : 'transparent',
                    borderColor: active ? '#22d3ee' : '#2a2a2a',
                    color: active ? '#22d3ee' : '#555',
                  }}
                >{v.toFixed(2)}</button>
              )
            })}
          </div>
        </div>
        </>
      )}
    </div>
  )
}
