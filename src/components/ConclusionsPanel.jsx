import { useMemo, useState } from 'react'
import ReactSelect from 'react-select'
import { CONCLUSION_TYPES, conclusionTypeLabel } from '../prompts/ConclusionTypes'
import { useUiStrings } from '../i18n/UiStringsContext'
import { SUGGESTION_MODE } from '../services/Suggestions'
import MagicWand from './MagicWand'
import { styles } from './Style'

// Names the portalled menu so the scroll guard below can tell the option list
// apart from the page scrolling underneath it.
const MENU_CLASS_PREFIX = 'conclusion-model'

// Above the panel and the chat, below the modal overlay layer.
const MENU_PORTAL_Z_INDEX = 1000

export default function ConclusionsPanel({ running, messages, models, modelSelectStyles, conclusions, wand }) {
  const UI_STRINGS = useUiStrings()
  const ui = UI_STRINGS.app
  const common = UI_STRINGS.common
  const {
    setConclusionModel,
    conclusionType,
    customConclusionPrompt,
    standardConclusionPrompts,
    standardPromptsVersion,
    promptRefs,
    commitCustomPrompt,
    commitStandardPrompt,
    conclusionRunning,
    effectiveConclusionModel,
    generateConclusion,
  } = conclusions
  // Taken off the object once, here: reading `promptRefs.standard` inside the
  // JSX reads a property of a ref holder during render, which the compiler
  // lint refuses even though nothing dereferences `.current`.
  const { custom: customPromptInput, standard: standardPromptInput } = promptRefs
  const [hasCustomPrompt, setHasCustomPrompt] = useState(() => !!customConclusionPrompt.trim())
  const [draftConclusionType, setDraftConclusionType] = useState(conclusionType)
  const standardPrompt = standardConclusionPrompts?.[draftConclusionType] ?? ''
  const selectStyles = useMemo(
    () => ({ ...modelSelectStyles, menuPortal: base => ({ ...base, zIndex: MENU_PORTAL_Z_INDEX }) }),
    [modelSelectStyles],
  )
  const [draftConclusionModel, setDraftConclusionModel] = useState(effectiveConclusionModel)
  const conclusionTypeDefinition = CONCLUSION_TYPES.find(entry => entry.id === draftConclusionType) || { color: '#888' }
  const conclusionTypeName = conclusionTypeDefinition.id
    ? conclusionTypeLabel(UI_STRINGS, conclusionTypeDefinition)
    : ui.conclusionFallbackLabel
  const hasConversation = messages.some(message => !['topic', 'interjection', 'error'].includes(message.role) && message.content?.trim())
  const isCustomPromptMissing = draftConclusionType === 'custom' && !hasCustomPrompt
  const isDisabled = !effectiveConclusionModel || conclusionRunning || isCustomPromptMissing
  const cloudModels = models.filter(model => model.endsWith('cloud')).sort()
  const localModels = models.filter(model => !model.endsWith('cloud')).sort()
  const options = [
    ...(cloudModels.length ? [{ label: common.cloud, options: cloudModels.map(model => ({ value: model, label: model })) }] : []),
    ...(localModels.length ? [{ label: common.local, options: localModels.map(model => ({ value: model, label: model })) }] : []),
  ]

  return (
    <>
      {conclusionRunning && (
        <div style={{ textAlign: 'center', margin: '8px 16px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: '#111820', border: `1px solid ${conclusionTypeDefinition.color}33`, borderRadius: 20, padding: '8px 18px', fontSize: 12, color: conclusionTypeDefinition.color, opacity: 0.85 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={conclusionTypeDefinition.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, animation: 'spin 1s linear infinite' }}>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
            <span>{ui.generatingConclusion(draftConclusionType === 'custom' ? (customConclusionPrompt.trim() || conclusionTypeName) : conclusionTypeName)}</span>
          </div>
        </div>
      )}
      {!running && !conclusionRunning && hasConversation && (
        <div style={{ textAlign: 'center', margin: '12px 16px' }}>
          <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 10, alignItems: 'stretch', background: '#161620', border: '1px solid #2e2e2e', borderRadius: 12, padding: '14px 20px', width: '92%', maxWidth: 700, boxSizing: 'border-box' }}>
            <span style={{ color: '#666', fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>{ui.conclusions}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {CONCLUSION_TYPES.map(type => {
                const active = draftConclusionType === type.id
                return <button key={type.id} onClick={() => setDraftConclusionType(type.id)} style={{ flex: 1, fontSize: 11, padding: '4px 0', borderRadius: 6, border: '1px solid', cursor: 'pointer', background: active ? `${type.color}22` : 'transparent', borderColor: active ? type.color : '#2a2a2a', color: active ? type.color : '#555', fontWeight: active ? 700 : 400, transition: 'all 0.15s' }}>{conclusionTypeLabel(UI_STRINGS, type)}</button>
              })}
            </div>
            {draftConclusionType === 'custom' ? (
              // Distinct key from the guidance textarea below: without one React
              // reuses the same DOM node across the two branches, and whatever
              // was typed in one shows up in the other.
              <textarea key="custom" defaultValue={customConclusionPrompt} ref={customPromptInput} onInput={event => { const present = !!event.currentTarget.value.trim(); setHasCustomPrompt(previous => previous === present ? previous : present) }} placeholder={ui.customConclusionPlaceholder} rows={3} style={{ width: '100%', boxSizing: 'border-box', background: '#0f0f0f', border: '1px solid #2e2e2e', borderRadius: 8, color: '#ddd', fontSize: 12, lineHeight: 1.5, padding: '8px 10px', resize: 'vertical' }} />
            ) : (
              // Keyed by type so switching tab swaps the guidance instead of
              // carrying one type's note into the next: each type keeps its own.
              <textarea key={`${draftConclusionType}:${standardPromptsVersion}`} defaultValue={standardPrompt} ref={standardPromptInput} onBlur={event => commitStandardPrompt(draftConclusionType, event.target.value)} placeholder={`${ui.standardConclusionPlaceholder} (${conclusionTypeName})`} rows={2} title={ui.standardConclusionTitle} style={{ width: '100%', boxSizing: 'border-box', background: '#0f0f0f', border: '1px solid #2e2e2e', borderRadius: 8, color: '#ddd', fontSize: 12, lineHeight: 1.45, padding: '8px 10px', resize: 'vertical' }} />
            )}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {wand && (
                <MagicWand
                  wand={wand}
                  mode={SUGGESTION_MODE.CONCLUSION}
                  placement="top"
                  onPick={suggestion => {
                    // Read from the textarea, not from state: what the user has
                    // typed since the last blur is not committed yet, and a
                    // suggestion must not silently drop it.
                    const isCustom = draftConclusionType === 'custom'
                    const input = isCustom ? customPromptInput : standardPromptInput
                    const current = String(input.current?.value ?? '').trim()
                    // Guidance accumulates: keep what the user already wrote.
                    const next = current ? `${current}\n${suggestion}` : suggestion
                    if (isCustom) commitCustomPrompt(next)
                    else commitStandardPrompt(draftConclusionType, next)
                  }}
                />
              )}
              <div style={{ flex: 1 }}>
                <ReactSelect
                  styles={selectStyles}
                  classNamePrefix={MENU_CLASS_PREFIX}
                  options={options}
                  value={draftConclusionModel ? { value: draftConclusionModel, label: draftConclusionModel } : null}
                  onChange={option => setDraftConclusionModel(option?.value ?? '')}
                  placeholder={common.chooseModel}
                  isClearable
                  menuPlacement="top"
                  // The panel lives inside the chat scroller, and the menu opens
                  // upward over it. Rendered inline it was positioned against a
                  // container that scrolls out from under it, which is what left
                  // it drawn across the panel until a scroll forced a repaint.
                  // Every other select in a clipping container is portalled the
                  // same way.
                  menuPortalTarget={typeof document === 'undefined' ? null : document.body}
                  // A portalled menu keeps the position it was given, so it has
                  // to close when the page moves under it — but not when the
                  // scrolling is the option list itself.
                  closeMenuOnScroll={event => !(event.target instanceof Element) || !event.target.closest(`.${MENU_CLASS_PREFIX}__menu`)}
                  noOptionsMessage={() => common.noModels}
                />
              </div>
              <button disabled={isDisabled} onClick={() => {
                // Only the textarea for the selected type is mounted, so the
                // other ref is null. Reading both and committing both wrote an
                // empty string over the prompt that was not on screen — asking
                // for a Summary erased the custom prompt, and the other way round.
                const isCustom = draftConclusionType === 'custom'
                const typed = String((isCustom ? customPromptInput : standardPromptInput).current?.value ?? '')
                setConclusionModel(draftConclusionModel)
                if (isCustom) commitCustomPrompt(typed)
                else commitStandardPrompt(draftConclusionType, typed)
                generateConclusion({
                  type: draftConclusionType,
                  model: draftConclusionModel,
                  customPrompt: isCustom ? typed : customConclusionPrompt,
                  standardPrompt: isCustom ? '' : typed,
                })
              }} style={{ ...styles.connectBtn(isDisabled), padding: '6px 18px', fontSize: 12, flexShrink: 0, background: conclusionRunning ? '#222' : `${conclusionTypeDefinition.color}22`, borderColor: `${conclusionTypeDefinition.color}66`, color: conclusionRunning ? '#555' : conclusionTypeDefinition.color }}>{conclusionRunning ? '…' : ui.generate}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
