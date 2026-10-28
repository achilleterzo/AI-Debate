import { useEffect, useState } from 'react'
import { useUiStrings } from '../i18n/UiStringsContext'
import { MAX_MODE_DESCRIPTION_CHARS } from '../services/ModeDraft'
import { themeColor as color } from '../theme/Theme'

/**
 * Describe a mode in a few sentences and have the default model write it. The
 * draft is not shown here: it becomes a mode of the user's own, selected in the
 * editor behind this dialog, where every field can be changed.
 */
export default function ModeGeneratorModal({ generator, onGenerated, onClose }) {
  const UI_STRINGS = useUiStrings()
  const ui = UI_STRINGS.modesSettings
  const appUi = UI_STRINGS.app
  const [description, setDescription] = useState('')
  const { running, error, available, unavailableReason, generate, cancel } = generator
  const ready = description.trim().length > 0 && available && !running

  useEffect(() => cancel, [cancel])
  useEffect(() => {
    const onKey = event => { if (event.key === 'Escape') { cancel(); onClose() } }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [cancel, onClose])

  const submit = async () => {
    if (!ready) return
    const draft = await generate(description)
    if (draft) onGenerated(draft)
  }
  const close = () => { cancel(); onClose() }

  const unavailable = unavailableReason === 'offline' ? appUi.wandOffline : unavailableReason === 'noModel' ? appUi.wandNoModel : ''
  const button = (primary, disabled) => ({
    background: primary ? color('#1f2a3f') : 'transparent',
    border: `1px solid ${primary ? color('#3f5a8a') : color('#3a3a3a')}`,
    color: primary ? color('#9fc2ff') : color('#888888'),
    borderRadius: 6, padding: '5px 14px', fontSize: 12, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
  })

  return (
    <div onClick={close} style={{ position: 'fixed', inset: 0, background: color('#000000bb'), display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
      <div onClick={event => event.stopPropagation()} style={{ background: color('#141414'), border: `1px solid ${color('#2e2e2e')}`, borderRadius: 10, width: 'min(94vw, 520px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: `1px solid ${color('#2e2e2e')}` }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: color('#dddddd') }}>✨ {ui.generateTitle}</span>
          <button onClick={close} style={{ background: 'transparent', border: 'none', color: color('#666666'), fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 12, color: color('#888888') }}>{ui.generateLabel}</label>
          <textarea
            autoFocus
            value={description}
            onChange={event => setDescription(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) submit() }}
            maxLength={MAX_MODE_DESCRIPTION_CHARS}
            rows={6}
            spellCheck={false}
            disabled={running}
            placeholder={ui.generatePlaceholder}
            style={{ width: '100%', boxSizing: 'border-box', background: color('#0f0f0f'), border: `1px solid ${color('#2e2e2e')}`, borderRadius: 8, color: color('#dddddd'), fontSize: 12, lineHeight: 1.5, padding: '8px 10px', resize: 'vertical', minHeight: 110 }}
          />
          <span style={{ fontSize: 11, color: color('#666666'), lineHeight: 1.45 }}>{ui.generateHint}</span>
          {unavailable && <span style={{ fontSize: 12, color: color('#f59e0b') }}>{unavailable}</span>}
          {error && !running && <span style={{ fontSize: 12, color: color('#f87171') }}>{error === 'empty' ? ui.generateFailed : `${ui.generateFailed} (${error})`}</span>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '10px 14px', borderTop: `1px solid ${color('#2e2e2e')}` }}>
          <button type="button" onClick={close} style={button(false, false)}>{UI_STRINGS.common.cancel}</button>
          <button type="button" disabled={!ready} onClick={submit} style={button(true, !ready)}>{running ? ui.generating : ui.generateAction}</button>
        </div>
      </div>
    </div>
  )
}
