import { useState } from 'react'
import EmojiPicker from './EmojiPicker'
import ModeGeneratorModal from './ModeGeneratorModal'
import { useUiStrings } from '../i18n/UiStringsContext'
import { DEBATE_MODES, MAX_ROUNDS_LIMIT, builtinModeDefinition, modeToolDefault } from '../prompts/Modes'
import {
  addModeEntry,
  duplicateModeEntry,
  isModeCustomized,
  moveModeEntry,
  removeModeEntry,
  resetModeEntry,
  toggleModeEntry,
  updateModeEntry,
} from '../prompts/ModeEditing'
import { MODERATION_COOLING_STEPS } from '../settings/Settings'
import { TOOL_SETTINGS } from '../tools/ToolSettings'
import { themeColor as color } from '../theme/Theme'

const inputStyle = {
  width: '100%', boxSizing: 'border-box', background: color('#0f0f0f'), border: `1px solid ${color('#2e2e2e')}`,
  borderRadius: 6, color: color('#dddddd'), padding: '5px 8px', fontSize: 12,
}
const textareaStyle = { ...inputStyle, lineHeight: 1.5, resize: 'vertical', minHeight: 96, padding: '8px 10px' }
const labelStyle = { fontSize: 12, color: color('#888') }
const hintStyle = { fontSize: 11, color: color('#666'), lineHeight: 1.45 }
const smallButton = disabled => ({
  background: 'transparent', border: `1px solid ${color('#3a3a3a')}`, color: color('#888'), borderRadius: 6,
  padding: '3px 10px', fontSize: 11, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1,
})
const iconButton = disabled => ({ ...smallButton(disabled), padding: '1px 6px', lineHeight: 1.4 })

function Switch({ on, onClick, title }) {
  return (
    <div
      onClick={onClick}
      role="switch"
      aria-checked={on}
      title={title}
      style={{ width: 30, height: 16, borderRadius: 8, position: 'relative', flexShrink: 0, background: on ? color('#4ade80') : color('#444444'), cursor: 'pointer', transition: 'background 0.2s' }}
    >
      <div style={{ position: 'absolute', top: 2, left: on ? 16 : 2, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
    </div>
  )
}

/** A setting a mode may replace: a tick to replace it, the control while replaced. */
function OverrideRow({ label, active, onToggle, general, children }) {
  const ui = useUiStrings().modesSettings
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 26, flexWrap: 'wrap' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 7, width: 220, flexShrink: 0, cursor: 'pointer', fontSize: 12, color: active ? color('#dddddd') : color('#999') }}>
        <input type="checkbox" checked={active} onChange={onToggle} />
        {label}
      </label>
      {active ? children : <span style={hintStyle}>{ui.follows(general)}</span>}
    </div>
  )
}

/**
 * The Modes tab: order, on/off, what each mode asks of the table, the settings
 * it replaces while selected, and the modes the user adds. Everything edits the
 * stored configuration; the registry follows it.
 */
export default function ModesSettings({ modesConfig, onModesConfigChange, general, generalPersonalityInstructions, running, modeGenerator }) {
  const UI_STRINGS = useUiStrings()
  const ui = UI_STRINGS.modesSettings
  const toolsUi = UI_STRINGS.promptSettingsModal
  const [selectedId, setSelectedId] = useState(modesConfig[0]?.id)
  const [generating, setGenerating] = useState(false)
  const entry = modesConfig.find(item => item.id === selectedId) ?? modesConfig[0]
  const mode = DEBATE_MODES.find(item => item.id === entry?.id)
  const builtin = entry ? builtinModeDefinition(entry.id) : null
  const enabledCount = modesConfig.filter(item => item.enabled).length

  const displayName = item => item.name || UI_STRINGS.modes[item.id] || item.label
  const edit = patch => onModesConfigChange(config => updateModeEntry(config, entry.id, patch))
  const editSettings = (key, value) => {
    const next = { ...entry.settings }
    if (value === undefined) delete next[key]
    else next[key] = value
    edit({ settings: next })
  }
  const add = build => {
    const result = build(modesConfig)
    if (!result.id) return
    onModesConfigChange(result.config)
    setSelectedId(result.id)
  }

  if (!entry || !mode) return null
  const settings = entry.settings ?? {}
  const customCount = modesConfig.filter(item => item.custom).length
  const toolOverrides = settings.enabledTools ?? {}

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: running ? 0.85 : 1 }}>
      {generating && (
        <ModeGeneratorModal
          generator={modeGenerator}
          onClose={() => setGenerating(false)}
          onGenerated={draft => {
            // The mode being edited is the one that is written: name, icon and
            // both purposes. Its settings and participant prompt are left alone.
            edit({ name: draft.name || entry.name, emoji: draft.emoji || entry.emoji, instruction: draft.instruction, conclusion: draft.conclusion })
            setGenerating(false)
          }}
        />
      )}
      <span style={hintStyle}>{ui.intro}</span>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ width: 250, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {modesConfig.map((item, index) => {
              const resolved = DEBATE_MODES.find(candidate => candidate.id === item.id)
              const selected = item.id === entry.id
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', borderRadius: 7, cursor: 'pointer',
                    background: selected ? color('#1f2a3f') : color('#101010'),
                    border: `1px solid ${selected ? color('#3f5a8a') : color('#252525')}`,
                    opacity: item.enabled ? 1 : 0.55,
                  }}
                >
                  <span style={{ width: 20, textAlign: 'center', fontSize: 14 }}>{resolved?.emoji}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: selected ? color('#9fc2ff') : color('#cccccc'), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {displayName(item)}
                    {item.custom && <span style={{ marginLeft: 6, fontSize: 10, color: color('#9b8bd4') }}>{ui.custom}</span>}
                    {!item.custom && isModeCustomized(item) && <span style={{ marginLeft: 6, fontSize: 10, color: color('#f59e0b') }}>{ui.edited}</span>}
                  </span>
                  <button type="button" title={ui.moveUp} aria-label={ui.moveUp} disabled={index === 0} onClick={event => { event.stopPropagation(); onModesConfigChange(config => moveModeEntry(config, item.id, -1)) }} style={iconButton(index === 0)}>▲</button>
                  <button type="button" title={ui.moveDown} aria-label={ui.moveDown} disabled={index === modesConfig.length - 1} onClick={event => { event.stopPropagation(); onModesConfigChange(config => moveModeEntry(config, item.id, 1)) }} style={iconButton(index === modesConfig.length - 1)}>▼</button>
                  <div onClick={event => event.stopPropagation()}>
                    <Switch
                      on={item.enabled}
                      title={item.enabled && enabledCount <= 1 ? ui.lastEnabled : (item.enabled ? ui.disable : ui.enable)}
                      onClick={() => onModesConfigChange(config => toggleModeEntry(config, item.id))}
                    />
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => add(config => addModeEntry(config, { name: ui.newModeName(customCount + 1) }))} style={smallButton(false)}>＋ {ui.newMode}</button>
            <button type="button" onClick={() => add(config => duplicateModeEntry(config, entry.id, ui.copyName(displayName(entry))))} style={smallButton(false)}>{ui.duplicate}</button>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 320, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {modeGenerator && (
            <div>
              <button type="button" onClick={() => setGenerating(true)} style={smallButton(false)}>✨ {ui.generate}</button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ width: 56, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{ui.fieldEmoji}</label>
              <EmojiPicker value={entry.emoji} fallback={builtin?.emoji ?? '🧭'} onChange={emoji => edit({ emoji })} resetLabel={ui.emojiReset} title={ui.fieldEmoji} />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{ui.fieldName}</label>
              <input value={entry.name} onChange={event => edit({ name: event.target.value })} placeholder={entry.custom ? '' : (UI_STRINGS.modes[entry.id] ?? builtin?.label)} maxLength={60} style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={labelStyle}>{ui.fieldInstruction}</label>
            <textarea
              value={entry.custom ? entry.instruction : (entry.instruction || mode.instruction || '')}
              onChange={event => edit({ instruction: event.target.value })}
              rows={4}
              spellCheck={false}
              style={textareaStyle}
            />
            <span style={hintStyle}>{ui.fieldInstructionHint}{!entry.custom && ` ${ui.builtInDefault}`}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={labelStyle}>{ui.fieldConclusion}</label>
            <textarea
              value={entry.custom ? entry.conclusion : (entry.conclusion || mode.conclusion)}
              onChange={event => edit({ conclusion: event.target.value })}
              rows={3}
              spellCheck={false}
              style={textareaStyle}
            />
            <span style={hintStyle}>{ui.fieldConclusionHint}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: `1px solid ${color('#242424')}`, paddingTop: 12 }}>
            <span style={labelStyle}>{ui.overridesTitle}</span>
            <span style={hintStyle}>{ui.overridesHint}</span>

            <OverrideRow label={ui.rounds} active={settings.maxTurns !== undefined} general={general.maxTurns} onToggle={() => editSettings('maxTurns', settings.maxTurns === undefined ? general.maxTurns : undefined)}>
              <input type="number" min={0} max={MAX_ROUNDS_LIMIT} value={settings.maxTurns ?? 0} onChange={event => editSettings('maxTurns', Number(event.target.value))} style={{ ...inputStyle, width: 80, textAlign: 'center' }} />
            </OverrideRow>

            {[['useSummary', ui.useSummary], ['randomTurnOrder', ui.randomTurnOrder], ['dynamicAffinity', ui.dynamicAffinity]].map(([key, label]) => (
              <OverrideRow key={key} label={label} active={settings[key] !== undefined} general={general[key] ? ui.on : ui.offValue} onToggle={() => editSettings(key, settings[key] === undefined ? !!general[key] : undefined)}>
                <Switch on={!!settings[key]} onClick={() => editSettings(key, !settings[key])} />
              </OverrideRow>
            ))}

            <OverrideRow label={ui.moderationCooling} active={settings.moderationCooling !== undefined} general={Number(general.moderationCooling).toFixed(2)} onToggle={() => editSettings('moderationCooling', settings.moderationCooling === undefined ? general.moderationCooling : undefined)}>
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {MODERATION_COOLING_STEPS.map(step => {
                  const active = Math.abs((settings.moderationCooling ?? 0) - step) < 0.0001
                  return <button key={step} type="button" onClick={() => editSettings('moderationCooling', step)} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, border: `1px solid ${active ? color('#22d3ee') : color('#2a2a2a')}`, cursor: 'pointer', background: active ? color('#0f3640') : 'transparent', color: active ? color('#22d3ee') : color('#555555') }}>{step.toFixed(2)}</button>
                })}
              </div>
            </OverrideRow>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
              <span style={labelStyle}>{ui.tools}</span>
              <span style={hintStyle}>{ui.toolsHint}</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {TOOL_SETTINGS.map(tool => {
                  const generalOn = modeToolDefault(entry.id, tool.id, general.enabledTools?.[tool.id] ?? tool.defaultEnabled !== false)
                  const overridden = toolOverrides[tool.id] !== undefined
                  const on = overridden ? toolOverrides[tool.id] : generalOn
                  // The switch shows the effective value; only a value that differs
                  // from the general setting is stored as an override.
                  const setTool = next => {
                    const tools = { ...toolOverrides }
                    if (next === generalOn) delete tools[tool.id]
                    else tools[tool.id] = next
                    editSettings('enabledTools', Object.keys(tools).length ? tools : undefined)
                  }
                  return (
                    <div key={tool.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '7px 9px', border: `1px solid ${color('#252525')}`, borderRadius: 7, background: color('#101010') }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <span style={{ fontSize: 14, width: 20, textAlign: 'center' }}>{tool.icon}</span>
                        <span style={{ fontSize: 12, color: overridden ? color('#dddddd') : color('#999999'), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{toolsUi[tool.labelKey]} <span style={{ color: color('#777777') }}>({tool.id})</span></span>
                        {tool.rolePlayOnly && <span style={{ fontSize: 10, color: color('#9b8bd4'), border: `1px solid ${color('#443b64')}`, borderRadius: 999, padding: '1px 6px', whiteSpace: 'nowrap' }}>{toolsUi.toolRolePlayOnly}</span>}
                        {tool.moderatorOnly && <span style={{ fontSize: 10, color: color('#fb923c'), border: `1px solid ${color('#6b4228')}`, borderRadius: 999, padding: '1px 6px', whiteSpace: 'nowrap' }}>{UI_STRINGS.common.moderator}</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {overridden && <span title={ui.overrideTool} style={{ ...hintStyle, color: color('#f59e0b'), whiteSpace: 'nowrap' }}>{ui.follows(generalOn ? ui.on : ui.offValue)}</span>}
                        <Switch on={on} onClick={() => setTool(!on)} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: `1px solid ${color('#242424')}`, paddingTop: 12 }}>
            <span style={labelStyle}>{ui.participantPromptTitle}</span>
            <span style={hintStyle}>{ui.participantPromptHint}</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 12, color: color('#cccccc') }}>
              <input
                type="checkbox"
                checked={typeof entry.personalityInstructions === 'string'}
                onChange={() => edit({ personalityInstructions: typeof entry.personalityInstructions === 'string' ? null : generalPersonalityInstructions })}
              />
              {ui.participantPromptOverride}
            </label>
            {typeof entry.personalityInstructions === 'string' && (
              <>
                <textarea value={entry.personalityInstructions} onChange={event => edit({ personalityInstructions: event.target.value })} rows={8} spellCheck={false} style={{ ...textareaStyle, minHeight: 140 }} />
                <div>
                  <button type="button" onClick={() => edit({ personalityInstructions: generalPersonalityInstructions })} style={smallButton(false)}>{ui.participantPromptCopy}</button>
                </div>
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, borderTop: `1px solid ${color('#242424')}`, paddingTop: 12 }}>
            {entry.custom
              ? (
                <button
                  type="button"
                  onClick={() => {
                    if (!window.confirm(ui.removeConfirm(displayName(entry)))) return
                    onModesConfigChange(config => removeModeEntry(config, entry.id))
                    setSelectedId(modesConfig.find(item => item.id !== entry.id)?.id)
                  }}
                  style={{ ...smallButton(false), borderColor: color('#5a2e2e'), color: color('#f87171') }}
                >{ui.remove}</button>
              )
              : (
                <button type="button" disabled={!isModeCustomized(entry)} onClick={() => onModesConfigChange(config => resetModeEntry(config, entry.id))} style={smallButton(!isModeCustomized(entry))}>{ui.restoreMode}</button>
              )}
          </div>
        </div>
      </div>
    </div>
  )
}
