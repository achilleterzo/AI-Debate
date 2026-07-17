import ReactSelect from 'react-select'
import { CONCLUSION_TYPES } from '../prompts/ConclusionTypes'
import { UI_STRINGS } from '../i18n/UiStrings'
import { styles } from './Style'

export default function ConclusionsPanel({ running, messages, models, modelSelectStyles, conclusions }) {
  const ui = UI_STRINGS.app
  const common = UI_STRINGS.common
  const {
    setConclusionModel,
    conclusionType,
    setConclusionType,
    customConclusionPrompt,
    setCustomConclusionPrompt,
    standardConclusionPrompt,
    setStandardConclusionPrompt,
    conclusionRunning,
    effectiveConclusionModel,
    generateConclusion,
  } = conclusions
  const conclusionTypeDefinition = CONCLUSION_TYPES.find(entry => entry.id === conclusionType) || { label: 'Conclusion', color: '#888' }
  const hasConversation = messages.some(message => !['topic', 'interjection', 'error'].includes(message.role) && message.content?.trim())
  const isCustomPromptMissing = conclusionType === 'custom' && !customConclusionPrompt.trim()
  const isDisabled = !effectiveConclusionModel || conclusionRunning || isCustomPromptMissing
  const cloudModels = models.filter(model => model.endsWith('cloud')).sort()
  const localModels = models.filter(model => !model.endsWith('cloud')).sort()
  const options = [
    ...(cloudModels.length ? [{ label: 'Cloud', options: cloudModels.map(model => ({ value: model, label: model })) }] : []),
    ...(localModels.length ? [{ label: 'Local', options: localModels.map(model => ({ value: model, label: model })) }] : []),
  ]

  return (
    <>
      {conclusionRunning && (
        <div style={{ textAlign: 'center', margin: '8px 16px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: '#111820', border: `1px solid ${conclusionTypeDefinition.color}33`, borderRadius: 20, padding: '8px 18px', fontSize: 12, color: conclusionTypeDefinition.color, opacity: 0.85 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={conclusionTypeDefinition.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, animation: 'spin 1s linear infinite' }}>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
            <span>{ui.generatingConclusion(conclusionType === 'custom' ? (customConclusionPrompt.trim() || conclusionTypeDefinition.label) : conclusionTypeDefinition.label)}</span>
          </div>
        </div>
      )}
      {!running && !conclusionRunning && hasConversation && (
        <div style={{ textAlign: 'center', margin: '12px 16px' }}>
          <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 10, alignItems: 'stretch', background: '#161620', border: '1px solid #2e2e2e', borderRadius: 12, padding: '14px 20px', width: '92%', maxWidth: 700, boxSizing: 'border-box' }}>
            <span style={{ color: '#666', fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>{ui.conclusions}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {CONCLUSION_TYPES.map(type => {
                const active = conclusionType === type.id
                return <button key={type.id} onClick={() => setConclusionType(type.id)} style={{ flex: 1, fontSize: 11, padding: '4px 0', borderRadius: 6, border: '1px solid', cursor: 'pointer', background: active ? `${type.color}22` : 'transparent', borderColor: active ? type.color : '#2a2a2a', color: active ? type.color : '#555', fontWeight: active ? 700 : 400, transition: 'all 0.15s' }}>{type.label}</button>
              })}
            </div>
            {conclusionType === 'custom' ? (
              <textarea value={customConclusionPrompt} onChange={event => setCustomConclusionPrompt(event.target.value)} placeholder={ui.customConclusionPlaceholder} rows={3} style={{ width: '100%', boxSizing: 'border-box', background: '#0f0f0f', border: '1px solid #2e2e2e', borderRadius: 8, color: '#ddd', fontSize: 12, lineHeight: 1.5, padding: '8px 10px', resize: 'vertical' }} />
            ) : (
              <textarea value={standardConclusionPrompt} onChange={event => setStandardConclusionPrompt(event.target.value)} placeholder={ui.standardConclusionPlaceholder} rows={2} title={ui.standardConclusionTitle} style={{ width: '100%', boxSizing: 'border-box', background: '#0f0f0f', border: '1px solid #2e2e2e', borderRadius: 8, color: '#ddd', fontSize: 12, lineHeight: 1.45, padding: '8px 10px', resize: 'vertical' }} />
            )}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <ReactSelect styles={modelSelectStyles} options={options} value={effectiveConclusionModel ? { value: effectiveConclusionModel, label: effectiveConclusionModel } : null} onChange={option => setConclusionModel(option?.value ?? '')} placeholder={common.chooseModel} isClearable menuPlacement="top" noOptionsMessage={() => common.noModels} />
              </div>
              <button disabled={isDisabled} onClick={generateConclusion} style={{ ...styles.connectBtn(isDisabled), padding: '6px 18px', fontSize: 12, flexShrink: 0, background: conclusionRunning ? '#222' : `${conclusionTypeDefinition.color}22`, borderColor: `${conclusionTypeDefinition.color}66`, color: conclusionRunning ? '#555' : conclusionTypeDefinition.color }}>{conclusionRunning ? '…' : ui.generate}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
