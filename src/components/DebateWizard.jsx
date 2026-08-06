import { useEffect, useMemo, useState } from 'react'
import ReactSelect from 'react-select'
import { UI_LANGUAGE_OPTIONS, formatLanguageLabel } from '../i18n/UiStrings'
import { useUiStrings } from '../i18n/UiStringsContext'
import { OUTPUT_LANG_CUSTOM, isCustomOutputLanguage } from '../prompts/LanguagePrompt'
import { WIZARD_MAX_PARTICIPANTS, WIZARD_MIN_PARTICIPANTS, WIZARD_STATUS } from '../hooks/useDebateWizard'

const languageOptions = UI_LANGUAGE_OPTIONS.map(language => ({ value: language.code, label: language.label, code: language.code }))

const STEP_COUNT = 3

// The card clips its content, so the menu is portalled to the body and lifted
// above the wizard's own 1200 overlay rather than being cut off inside it.
const withPortalledMenu = base => ({
  ...base,
  menuPortal: portalBase => ({ ...portalBase, zIndex: 1300 }),
})

const chipStyle = (active, disabled) => ({
  background: active ? '#2a2440' : '#151515',
  border: `1px solid ${active ? '#7c6aff' : '#303030'}`,
  color: active ? '#c4b5fd' : '#999',
  borderRadius: 999,
  padding: '5px 11px',
  fontSize: 12,
  cursor: disabled ? 'default' : 'pointer',
  opacity: disabled ? 0.6 : 1,
})

function FieldLabel({ children, hint }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#777', textTransform: 'uppercase', letterSpacing: 0.6 }}>{children}</span>
      {hint && <span style={{ fontSize: 11, color: '#7d7d7d' }}>{hint}</span>}
    </div>
  )
}

/**
 * Three-step debate setup, in the welcome screen's clothes.
 *
 * The steps only collect the answers; generating is the caller's job, and it
 * replaces the whole table — which is why the last step says so before the
 * button that does it.
 */
export default function DebateWizard({
  onClose,
  onGenerate,
  wizard,
  debateMode,
  debateModeOptions = [],
  uiLang,
  characterTypes = [],
  moodSelectStyles,
}) {
  const UI_STRINGS = useUiStrings()
  const ui = UI_STRINGS.wizard
  const appUi = UI_STRINGS.app
  const common = UI_STRINGS.common
  const participantsUi = UI_STRINGS.participants
  const modeLabels = UI_STRINGS.modes

  const [step, setStep] = useState(1)
  const [mode, setMode] = useState(debateMode)
  const [lang, setLang] = useState(uiLang)
  const [customLang, setCustomLang] = useState(isCustomOutputLanguage(uiLang) ? uiLang : '')
  const [count, setCount] = useState(WIZARD_MIN_PARTICIPANTS)
  const [characterType, setCharacterType] = useState(null)
  const [withModerator, setWithModerator] = useState(false)
  const [purpose, setPurpose] = useState('')

  const running = wizard.isRunning
  const usingCustomLang = isCustomOutputLanguage(lang) || lang === OUTPUT_LANG_CUSTOM
  const languageSelectStyles = useMemo(() => withPortalledMenu(moodSelectStyles), [moodSelectStyles])

  useEffect(() => {
    const handler = event => {
      if (event.key === 'Escape' && !running) onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose, running])

  const resolvedLang = usingCustomLang ? customLang.trim() : lang
  const canGenerate = wizard.available && !running && !!resolvedLang

  const unavailableNote = wizard.unavailableReason === 'offline'
    ? appUi.wandOffline
    : wizard.unavailableReason === 'noModel'
      ? appUi.wandNoModel
      : null

  const stepTitles = [ui.step1Title, ui.step2Title, ui.step3Title]

  const submit = () => {
    if (!canGenerate) return
    onGenerate({
      debateMode: mode,
      uiLang: resolvedLang,
      count,
      characterType,
      withModerator,
      purpose: purpose.trim(),
    })
  }

  return (
    <div
      onClick={() => !running && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        background: '#000000cc',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ui.title}
        onClick={event => event.stopPropagation()}
        style={{
          background: 'radial-gradient(120% 120% at 50% 0%, #221c3a 0%, #141414 55%)',
          border: '1px solid #2e2e2e',
          borderRadius: 14,
          width: 'min(94vw, 560px)',
          maxHeight: '92vh',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 18px 48px #000a',
        }}
      >
        <div style={{ padding: '20px 24px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#f0f0f0' }}>{ui.title}</div>
            <span style={{ fontSize: 11, color: '#777', fontFamily: 'var(--mono)' }}>{ui.stepOf(step, STEP_COUNT)}</span>
          </div>
          <p style={{ fontSize: 12, color: '#9a9a9a', lineHeight: 1.5 }}>{ui.tagline}</p>
          <div style={{ display: 'flex', gap: 6 }}>
            {stepTitles.map((title, index) => (
              <div
                key={title}
                title={title}
                style={{
                  flex: 1, height: 3, borderRadius: 2,
                  background: index + 1 <= step ? '#7c6aff' : '#2e2e2e',
                }}
              />
            ))}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#ddd' }}>{stepTitles[step - 1]}</div>
        </div>

        <div style={{ padding: '0 24px 18px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {step === 1 && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <FieldLabel>{common.debateMode}</FieldLabel>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {debateModeOptions.map(option => {
                    const label = modeLabels?.[option.value] ?? option.label
                    return (
                      <button key={option.value} type="button" onClick={() => setMode(option.value)} disabled={running} style={chipStyle(option.value === mode, running)}>
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <FieldLabel>{appUi.language}</FieldLabel>
                <ReactSelect
                  styles={languageSelectStyles}
                  menuPortalTarget={document.body}
                  options={[{ value: OUTPUT_LANG_CUSTOM, label: participantsUi.reasoningLangCustom }, ...languageOptions]}
                  value={usingCustomLang
                    ? { value: OUTPUT_LANG_CUSTOM, label: participantsUi.reasoningLangCustom }
                    : (languageOptions.find(option => option.value === lang) ?? null)}
                  onChange={option => setLang(option.value)}
                  formatOptionLabel={option => option.code ? formatLanguageLabel(option) : option.label}
                  isDisabled={running}
                  menuPlacement="auto"
                />
                {usingCustomLang && (
                  <input
                    value={customLang}
                    onChange={event => setCustomLang(event.target.value)}
                    placeholder={participantsUi.reasoningLangCustomPlaceholder}
                    spellCheck={false}
                    disabled={running}
                    autoFocus
                    style={{ width: '100%', boxSizing: 'border-box', background: '#0f0f0f', border: '1px solid #2e2e2e', borderRadius: 8, color: '#ddd', fontSize: 13, padding: '8px 10px' }}
                  />
                )}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <FieldLabel hint={withModerator ? ui.moderatorTotal(count) : null}>{ui.participantsCount}</FieldLabel>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {Array.from({ length: WIZARD_MAX_PARTICIPANTS - WIZARD_MIN_PARTICIPANTS + 1 }, (_, index) => index + WIZARD_MIN_PARTICIPANTS).map(value => (
                    <button key={value} type="button" onClick={() => setCount(value)} disabled={running} style={{ ...chipStyle(value === count, running), minWidth: 38 }}>
                      {value}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <FieldLabel>{ui.characterType}</FieldLabel>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {characterTypes.map(type => (
                    <button key={type.label} type="button" onClick={() => setCharacterType(type.value)} disabled={running} style={chipStyle((type.value ?? null) === characterType, running)}>
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#bbb', cursor: running ? 'default' : 'pointer' }}>
                <input
                  type="checkbox"
                  checked={withModerator}
                  onChange={event => setWithModerator(event.target.checked)}
                  disabled={running}
                  style={{ width: 14, height: 14, accentColor: '#7c6aff', cursor: running ? 'default' : 'pointer' }}
                />
                {ui.withModerator}
              </label>
            </>
          )}

          {step === 3 && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <FieldLabel hint={ui.purposeHint}>{ui.purposeTitle}</FieldLabel>
                <textarea
                  value={purpose}
                  onChange={event => setPurpose(event.target.value)}
                  placeholder={ui.purposePlaceholder}
                  disabled={running}
                  rows={5}
                  autoFocus
                  style={{
                    width: '100%', boxSizing: 'border-box', resize: 'vertical',
                    background: '#0f0f0f', border: '1px solid #2e2e2e', borderRadius: 8,
                    color: '#ddd', fontSize: 13, padding: '9px 10px', fontFamily: 'inherit', lineHeight: 1.5,
                  }}
                />
              </div>
              <div style={{ fontSize: 11, color: '#f0a86a', background: '#2a1f14', border: '1px solid #5c3f21', borderRadius: 8, padding: '8px 10px', lineHeight: 1.5 }}>
                {ui.replaceWarning}
              </div>
              {running && (
                <div style={{ fontSize: 12, color: '#c4b5fd' }}>
                  {wizard.step === 'participants' ? ui.progressParticipants
                    : wizard.step === 'moderator' ? ui.progressModerator
                      : ui.progressRules}
                </div>
              )}
              {wizard.status === WIZARD_STATUS.ERROR && !running && (
                <div style={{ fontSize: 12, color: '#f87171' }}>{wizard.error || ui.generateFailed}</div>
              )}
              {unavailableNote && <div style={{ fontSize: 12, color: '#f87171' }}>{unavailableNote}</div>}
            </>
          )}
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          padding: '12px 24px', borderTop: '1px solid #2e2e2e', background: '#141414', flexWrap: 'wrap',
        }}>
          <button
            onClick={() => step === 1 ? onClose() : setStep(step - 1)}
            disabled={running}
            style={{ background: 'transparent', border: '1px solid #3a3a3a', color: '#888', borderRadius: 6, padding: '7px 16px', fontSize: 12, cursor: running ? 'default' : 'pointer', opacity: running ? 0.6 : 1 }}
          >
            {step === 1 ? common.cancel : ui.back}
          </button>
          {step < STEP_COUNT ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={step === 1 && !resolvedLang}
              style={{ background: '#1f2a3f', border: '1px solid #3f5a8a', color: '#9fc2ff', borderRadius: 6, padding: '7px 18px', fontSize: 13, fontWeight: 600, cursor: step === 1 && !resolvedLang ? 'default' : 'pointer', opacity: step === 1 && !resolvedLang ? 0.6 : 1 }}
            >
              {ui.next}
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={!canGenerate}
              style={{ background: '#2a2440', border: '1px solid #7c6aff', color: '#c4b5fd', borderRadius: 6, padding: '7px 18px', fontSize: 13, fontWeight: 600, cursor: canGenerate ? 'pointer' : 'default', opacity: canGenerate ? 1 : 0.6 }}
            >
              {running ? ui.generating : ui.generate}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
