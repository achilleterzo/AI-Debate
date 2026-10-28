import { useUiStrings } from '../i18n/UiStringsContext'
import {
  ACCENT_PRESETS,
  DEFAULT_APPEARANCE,
  MESSAGE_FONT_SIZE_STEPS,
  THEME_CHOICES,
  participantColor,
  themeColor,
} from '../theme/Theme'

const color = themeColor

const sectionStyle = { display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }
const labelStyle = { fontSize: 12, color: color('#888') }
const hintStyle = { fontSize: 11, color: color('#666'), lineHeight: 1.45 }

const chip = active => ({
  background: active ? color('#1f2a3f') : 'transparent',
  border: `1px solid ${active ? color('#3f5a8a') : color('#2e2e2e')}`,
  color: active ? color('#9fc2ff') : color('#999'),
  borderRadius: 6,
  padding: '4px 12px',
  cursor: 'pointer',
  fontSize: 12,
})

/**
 * Theme, accent and the size of the answers in the chat. The size is only the
 * balloons' text: tools, reasoning and the interface keep theirs.
 */
export default function AppearanceSettings({ appearance, onAppearanceChange }) {
  const ui = useUiStrings().appearance
  const patch = change => onAppearanceChange({ ...appearance, ...change })
  const isDefault = appearance.theme === DEFAULT_APPEARANCE.theme
    && appearance.accent === DEFAULT_APPEARANCE.accent
    && appearance.messageFontSize === DEFAULT_APPEARANCE.messageFontSize
  const themeLabels = { dark: ui.themeDark, light: ui.themeLight, system: ui.themeSystem }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={sectionStyle}>
        <span style={labelStyle}>{ui.themeTitle}</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {THEME_CHOICES.map(theme => (
            <button key={theme} type="button" onClick={() => patch({ theme })} style={chip(appearance.theme === theme)}>{themeLabels[theme]}</button>
          ))}
        </div>
        <span style={hintStyle}>{ui.themeHint}</span>
      </div>

      <div style={sectionStyle}>
        <span style={labelStyle}>{ui.accentTitle}</span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {ACCENT_PRESETS.map(preset => {
            const active = appearance.accent === preset.id
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => patch({ accent: preset.id })}
                title={ui.accents[preset.id]}
                aria-label={ui.accents[preset.id]}
                aria-pressed={active}
                style={{
                  width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', padding: 0,
                  background: preset.swatch,
                  border: `2px solid ${active ? color('#ffffff') : 'transparent'}`,
                  outline: active ? `1px solid ${color('#444444')}` : 'none',
                }}
              />
            )
          })}
        </div>
        <span style={hintStyle}>{ui.accentHint}</span>
      </div>

      <div style={sectionStyle}>
        <span style={labelStyle}>{ui.messageSizeTitle}</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {MESSAGE_FONT_SIZE_STEPS.map(size => (
            <button key={size} type="button" onClick={() => patch({ messageFontSize: size })} style={chip(appearance.messageFontSize === size)}>
              {size}{ui.messageSizeUnit}
            </button>
          ))}
        </div>
        <span style={hintStyle}>{ui.messageSizeHint}</span>
        <div
          className="bubble balloon"
          style={{
            '--balloon-font-size': `${appearance.messageFontSize}px`,
            '--balloon-bg': participantColor('#1c1c2e'),
            '--balloon-border': participantColor('#7c6aff44'),
            '--balloon-radius': '12px 12px 12px 2px',
            maxWidth: 420,
          }}
        >
          {ui.messageSizePreview}
        </div>
      </div>

      <div>
        <button
          type="button"
          disabled={isDefault}
          onClick={() => onAppearanceChange({ ...DEFAULT_APPEARANCE })}
          style={{ background: 'transparent', border: `1px solid ${color('#3a3a3a')}`, color: color('#888'), borderRadius: 6, padding: '4px 12px', cursor: isDefault ? 'default' : 'pointer', opacity: isDefault ? 0.5 : 1, fontSize: 12 }}
        >{ui.restoreDefaults}</button>
      </div>
    </div>
  )
}
