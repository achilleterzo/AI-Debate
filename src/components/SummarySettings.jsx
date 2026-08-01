import ReactSelect from 'react-select'
import { SUMMARY_ACCUMULATE_STEPS } from '../settings/Settings'
import { useUiStrings } from '../i18n/UiStringsContext'

export default function SummarySettings({
  useSummary,
  onUseSummaryChange,
  summarizeAttachments,
  onSummarizeAttachmentsChange,
  summaryAccumulateThreshold,
  onSummaryAccumulateThresholdChange,
  summaryModelOverride,
  onSummaryModelOverrideChange,
  models,
  modelSelectStyles,
  running,
  defaultModel = '',
  summaryEndpointOverride = '',
  onConfigureEndpoint,
}) {
  const UI_STRINGS = useUiStrings()
  const ui = UI_STRINGS.app
  const common = UI_STRINGS.common

  // Same explicit entry as the participant model picker: an empty override
  // means "use the default model", and that has to be selectable rather than
  // only reachable by clearing the field.
  const defaultModelOption = {
    value: '',
    label: defaultModel
      ? `${UI_STRINGS.participants.useDefaultModel} · ${defaultModel}`
      : UI_STRINGS.participants.useDefaultModelUnset,
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 0 2px' }}>
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
        <div style={{ flex: 1 }}>
          <ReactSelect
            styles={modelSelectStyles}
            options={(() => {
              const cloud = models.filter(m => m.endsWith('cloud')).sort()
              const local = models.filter(m => !m.endsWith('cloud')).sort()
              return [
                defaultModelOption,
                ...(cloud.length ? [{ label: common.cloud, options: cloud.map(m => ({ value: m, label: m })) }] : []),
                ...(local.length ? [{ label: common.local, options: local.map(m => ({ value: m, label: m })) }] : []),
              ]
            })()}
            value={summaryModelOverride ? { value: summaryModelOverride, label: summaryModelOverride } : defaultModelOption}
            onChange={opt => onSummaryModelOverrideChange(opt?.value ?? '')}
            placeholder={common.chooseModel}
            isDisabled={running || !useSummary}
            menuPlacement="auto"
            noOptionsMessage={() => common.noModels}
          />
        </div>
        {(() => {
          const hasOverride = !!summaryEndpointOverride?.trim()
          return (
            <button
              onClick={() => !running && onConfigureEndpoint?.()}
              disabled={running || !useSummary}
              title={hasOverride
                ? UI_STRINGS.participants.customEndpointTitle(summaryEndpointOverride, null)
                : UI_STRINGS.participants.configureCustomEndpoint}
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                border: `1px solid ${hasOverride ? '#2f4f6f' : '#2e2e2e'}`,
                background: hasOverride ? '#152131' : '#161616',
                color: hasOverride ? '#9ac8ff' : '#666',
                cursor: running || !useSummary ? 'default' : 'pointer',
                opacity: running || !useSummary ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M2 12h20" />
                <path d="M12 2c3 3 4 6 4 10s-1 7-4 10c-3-3-4-6-4-10s1-7 4-10z" />
              </svg>
            </button>
          )
        })()}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '2px 0 6px' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} title={ui.accumulateSummaryOn(summaryAccumulateThreshold)}>
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
