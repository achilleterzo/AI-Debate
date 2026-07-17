import ReactSelect from 'react-select'
import { SUMMARY_ACCUMULATE_STEPS } from '../settings/Settings'
import { UI_STRINGS } from '../i18n/UiStrings'

export default function SummarySettings({
  useSummary,
  onUseSummaryChange,
  summarizeAttachments,
  onSummarizeAttachmentsChange,
  summaryAccumulate,
  onSummaryAccumulateChange,
  summaryAccumulateThreshold,
  onSummaryAccumulateThresholdChange,
  summaryModelEnabled,
  onSummaryModelEnabledChange,
  summaryModelOverride,
  onSummaryModelOverrideChange,
  models,
  modelSelectStyles,
  running,
}) {
  const ui = UI_STRINGS.app
  const common = UI_STRINGS.common

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '2px 0 2px' }}>
        <div
          onClick={() => !running && onUseSummaryChange(!useSummary)}
          title={useSummary ? ui.perRoundSummaryOn : ui.perRoundSummaryOff}
          style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: running ? 'default' : 'pointer', userSelect: 'none', opacity: running ? 0.5 : 1 }}
        >
          <div style={{ width: 32, height: 16, borderRadius: 8, position: 'relative', background: useSummary ? '#4ade80' : '#444', transition: 'background 0.2s', flexShrink: 0 }}>
            <div style={{ position: 'absolute', top: 2, left: useSummary ? 18 : 2, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
          </div>
          <span style={{ fontSize: 12, color: useSummary ? '#4ade80' : '#666', whiteSpace: 'nowrap' }}>
            {useSummary ? ui.perRoundSummary : ui.perMessageSummary}
          </span>
        </div>
        <div style={{ width: 1, height: 18, background: '#2e2e2e', flexShrink: 0 }} />
        <div
          onClick={() => !running && onSummarizeAttachmentsChange(!summarizeAttachments)}
          title={summarizeAttachments
            ? 'Attachment summarization active: attached documents are analytically summarized first using the summary model'
            : 'Enable analytical summarization of attachments with the summary model'}
          style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: running ? 'default' : 'pointer', userSelect: 'none', opacity: running ? 0.5 : 1 }}
        >
          <div style={{ width: 32, height: 16, borderRadius: 8, position: 'relative', background: summarizeAttachments ? '#22d3ee' : '#444', transition: 'background 0.2s', flexShrink: 0 }}>
            <div style={{ position: 'absolute', top: 2, left: summarizeAttachments ? 18 : 2, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
          </div>
          <span style={{ fontSize: 12, color: summarizeAttachments ? '#22d3ee' : '#666', whiteSpace: 'nowrap' }}>{ui.summarizeAttachments}</span>
        </div>
        <div
          onClick={() => !running && onSummaryAccumulateChange(!summaryAccumulate)}
          title={summaryAccumulate
            ? ui.accumulateSummaryOn(summaryAccumulateThreshold)
            : ui.accumulateSummaryOff(summaryAccumulateThreshold)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: running ? 'default' : 'pointer', userSelect: 'none', opacity: running ? 0.5 : 1 }}
        >
          <div style={{ width: 32, height: 16, borderRadius: 8, position: 'relative', background: summaryAccumulate ? '#a78bfa' : '#444', transition: 'background 0.2s', flexShrink: 0 }}>
            <div style={{ position: 'absolute', top: 2, left: summaryAccumulate ? 18 : 2, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
          </div>
          <span style={{ fontSize: 12, color: summaryAccumulate ? '#a78bfa' : '#666', whiteSpace: 'nowrap' }}>
            {summaryAccumulate ? ui.accumulateSummaryCompact(summaryAccumulateThreshold) : ui.accumulateSummary}
          </span>
        </div>
        {summaryAccumulate && (
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
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 0 6px' }}>
        <div
          onClick={() => !running && onSummaryModelEnabledChange(!summaryModelEnabled)}
          title={summaryModelEnabled ? 'Use dedicated model for summaries (click to disable)' : 'Enable dedicated model for summaries'}
          style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: running ? 'default' : 'pointer', userSelect: 'none', opacity: running ? 0.5 : 1 }}
        >
          <div style={{ width: 32, height: 16, borderRadius: 8, position: 'relative', background: summaryModelEnabled ? '#4a9eff' : '#444', transition: 'background 0.2s', flexShrink: 0 }}>
            <div style={{ position: 'absolute', top: 2, left: summaryModelEnabled ? 18 : 2, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
          </div>
          <span style={{ fontSize: 12, color: summaryModelEnabled ? '#4a9eff' : '#666', whiteSpace: 'nowrap' }}>{ui.summaryModel}</span>
        </div>
        <div style={{ flex: 1 }}>
          <ReactSelect
            styles={modelSelectStyles}
            options={(() => {
              const cloud = models.filter(m => m.endsWith('cloud')).sort()
              const local = models.filter(m => !m.endsWith('cloud')).sort()
              return [
                ...(cloud.length ? [{ label: 'Cloud', options: cloud.map(m => ({ value: m, label: m })) }] : []),
                ...(local.length ? [{ label: 'Local', options: local.map(m => ({ value: m, label: m })) }] : []),
              ]
            })()}
            value={summaryModelOverride ? { value: summaryModelOverride, label: summaryModelOverride } : null}
            onChange={opt => onSummaryModelOverrideChange(opt?.value ?? '')}
            placeholder={common.chooseModel}
            isClearable
            isDisabled={running || !summaryModelEnabled}
            menuPlacement="auto"
            noOptionsMessage={() => common.noModels}
          />
        </div>
      </div>
    </>
  )
}
