import ReactSelect from 'react-select'
import { SUMMARY_ACCUMULATE_STEPS } from '../settings/Settings'
import { UI_LANGUAGE_OPTIONS, formatLanguageLabel } from '../i18n/UiStrings'
import { useUiStrings } from '../i18n/UiStringsContext'
import { OUTPUT_LANG_CUSTOM, isCustomOutputLanguage } from '../prompts/LanguagePrompt'
import EndpointModelGroup from './EndpointModelGroup'
import { styles } from './Style'

const languageOptions = UI_LANGUAGE_OPTIONS.map(language => ({ value: language.code, label: language.label, code: language.code }))

export default function SummarySettings({
  uiLang,
  onUiLangChange,
  onConfigureCustomLang,
  moodSelectStyles,
  useSummary,
  onUseSummaryChange,
  summarizeAttachments,
  onSummarizeAttachmentsChange,
  summaryAccumulateThreshold,
  onSummaryAccumulateThresholdChange,
  summaryModelEnabled,
  onSummaryModelEnabledChange,
  summaryModelOverride,
  onSummaryModelOverrideChange,
  models,
  running,
  defaultModel = '',
  summaryEndpointOverride = '',
  summaryEndpointState = '',
  onConfigureEndpoint,
}) {
  const UI_STRINGS = useUiStrings()
  const ui = UI_STRINGS.app
  const participantsUi = UI_STRINGS.participants
  // A custom language is stored as the text itself, so "is it custom?" is just
  // "is it absent from the list?" — and the picker shows what was typed.
  const customLang = isCustomOutputLanguage(uiLang)
  const customOption = { value: OUTPUT_LANG_CUSTOM, label: customLang ? uiLang : participantsUi.reasoningLangCustom }
  const outputLangOptions = [customOption, ...languageOptions]

  return (
    <>
      <div style={styles.settingsRow}>
        {/* Session language leads this row: it is the other setting that
            applies to the whole conversation rather than to a participant. */}
        <span style={styles.endpointLabel}>{ui.language}</span>
        <div style={{ minWidth: 150 }}>
          <ReactSelect
            styles={moodSelectStyles}
            options={outputLangOptions}
            value={customLang ? customOption : (languageOptions.find(option => option.value === uiLang) ?? null)}
            // Picking "Other" only opens the editor: what is stored is the text
            // typed there, so the sentinel never becomes the debate language.
            onChange={option => option.value === OUTPUT_LANG_CUSTOM ? onConfigureCustomLang?.() : onUiLangChange(option.value)}
            formatOptionLabel={option => option.code ? formatLanguageLabel(option) : option.label}
            isDisabled={running}
            menuPlacement="auto"
          />
        </div>
        {customLang && (
          <button
            onClick={() => onConfigureCustomLang?.()}
            disabled={running}
            title={participantsUi.reasoningLangCustomEdit}
            aria-label={participantsUi.reasoningLangCustomEdit}
            style={{
              width: 24, height: 24, borderRadius: 6, flexShrink: 0,
              border: '1px solid #4a2f63', background: '#1f1726', color: '#caa9ee',
              cursor: running ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: running ? 0.5 : 1,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
        )}
        <div style={{ width: 1, height: 18, background: '#2e2e2e', flexShrink: 0 }} />
        <div
          onClick={() => !running && onUseSummaryChange(!useSummary)}
          title={useSummary ? ui.perRoundSummaryOn : ui.perRoundSummaryOff}
          style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: running ? 'default' : 'pointer', userSelect: 'none', opacity: running ? 0.5 : 1 }}
        >
          <div style={{ width: 32, height: 16, borderRadius: 8, position: 'relative', background: useSummary ? '#4a9eff' : '#444', transition: 'background 0.2s', flexShrink: 0 }}>
            <div style={{ position: 'absolute', top: 2, left: useSummary ? 18 : 2, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
          </div>
          <span style={{ fontSize: 12, color: useSummary ? '#4a9eff' : '#666', whiteSpace: 'nowrap' }}>{ui.contextSummary}</span>
        </div>
        <div
          onClick={() => !running && onSummaryModelEnabledChange(!summaryModelEnabled)}
          title={summaryModelEnabled ? ui.summaryModelTitleOn : ui.summaryModelTitleOff}
          style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: running ? 'default' : 'pointer', userSelect: 'none', opacity: running ? 0.5 : 1 }}
        >
          <div style={{ width: 32, height: 16, borderRadius: 8, position: 'relative', background: summaryModelEnabled ? '#a78bfa' : '#444', transition: 'background 0.2s', flexShrink: 0 }}>
            <div style={{ position: 'absolute', top: 2, left: summaryModelEnabled ? 18 : 2, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
          </div>
          <span style={{ fontSize: 12, color: summaryModelEnabled ? '#a78bfa' : '#666', whiteSpace: 'nowrap' }}>{ui.summaryModel}</span>
        </div>
        {/* Hidden while the override is off: the summary then runs on the
            default model. */}
        {summaryModelEnabled && (
          <EndpointModelGroup
            models={models}
            model={summaryModelOverride}
            onModelChange={onSummaryModelOverrideChange}
            defaultModel={defaultModel}
            endpointOverride={summaryEndpointOverride}
            endpointState={summaryEndpointState}
            onConfigureEndpoint={onConfigureEndpoint}
            disabled={running || !useSummary}
            minWidth={140}
          />
        )}
      </div>
      <div style={{ ...styles.settingsRow, flexWrap: 'wrap' }}>
        <div
          onClick={() => !running && onSummarizeAttachmentsChange(!summarizeAttachments)}
          title={summarizeAttachments ? ui.summarizeAttachmentsTitleOn : ui.summarizeAttachmentsTitleOff}
          style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: running ? 'default' : 'pointer', userSelect: 'none', opacity: running ? 0.5 : 1 }}
        >
          <div style={{ width: 32, height: 16, borderRadius: 8, position: 'relative', background: summarizeAttachments ? '#22d3ee' : '#444', transition: 'background 0.2s', flexShrink: 0 }}>
            <div style={{ position: 'absolute', top: 2, left: summarizeAttachments ? 18 : 2, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
          </div>
          <span style={{ fontSize: 12, color: summarizeAttachments ? '#22d3ee' : '#666', whiteSpace: 'nowrap' }}>{ui.summarizeAttachments}</span>
        </div>
        <div style={{ width: 1, height: 18, background: '#2e2e2e', flexShrink: 0 }} />
        {/* The context size always applies: it is what bounds the payload when
            no summary is running. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} title={ui.accumulateSummaryOn(summaryAccumulateThreshold)}>
          <span style={{ fontSize: 12, color: '#a78bfa', whiteSpace: 'nowrap' }}>
            {ui.accumulateSummaryCompact(summaryAccumulateThreshold)}
          </span>
          <div style={{ display: 'flex', gap: 3 }}>
            {SUMMARY_ACCUMULATE_STEPS.map(kb => {
              const active = summaryAccumulateThreshold === kb
              return (
                <button key={kb}
                  disabled={running}
                  onClick={() => onSummaryAccumulateThresholdChange(kb)}
                  style={{
                    fontSize: 10, padding: '2px 6px', borderRadius: 4, border: '1px solid',
                    cursor: running ? 'default' : 'pointer',
                    background: active ? '#3b1f6e' : 'transparent',
                    borderColor: active ? '#a78bfa' : '#2a2a2a',
                    color: active ? '#a78bfa' : '#444',
                  }}
                >{kb}K</button>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
