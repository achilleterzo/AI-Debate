import { SUMMARY_ACCUMULATE_STEPS } from '../settings/Settings'
import { useUiStrings } from '../i18n/UiStringsContext'
import EndpointModelGroup from './EndpointModelGroup'
import { styles } from './Style'

export default function SummarySettings({
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

  return (
    <>
      <div style={styles.settingsRow}>
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
