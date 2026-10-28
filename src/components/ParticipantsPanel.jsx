import { useState } from 'react'
import { styles } from './Style'
import ReactSelect from 'react-select'
import { UI_LANGUAGE_OPTIONS, formatLanguageLabel } from '../i18n/UiStrings'
import { useUiStrings } from '../i18n/UiStringsContext'
import { Debate } from '../debate/Debate'
import {
  MAX_MODERATOR_FACILITATION_INTERVAL,
  MIN_MODERATOR_FACILITATION_INTERVAL,
  normalizeModeratorFacilitationInterval,
} from '../settings/Settings'
import { participantMode } from '../services/Suggestions'
import EndpointModelGroup from './EndpointModelGroup'
import MagicWand from './MagicWand'
import RemoveButton from './RemoveButton'
import { participantColor } from '../theme/Theme'
import { thinkingLevelLabel, thinkingLevelOptions } from './ThinkingLevels'
import TemperatureSlider from './TemperatureSlider'
import StackedSlider from './StackedSlider'

export default function ParticipantsPanel({
  participants,
  setParticipants,
  userModel,
  characterTypes,
  responseLengths,
  moodSelectStyles,
  moodOptions,
  formatMoodOption,
  moods,
  moodIntensity,
  defaultMoodIntensity,
  educationLevels,
  ageGroups,
  defaultAgeGroup,
  models,
  providerModels = {},
  defaultProviderId = 'ollama',
  palette,
  mkParticipant,
  running,
  onResetAffinities,
  onResetProviders,
  onAddConstraint,
  onEditConstraint,
  onDeleteConstraint,
  onRequestRemoveParticipant,
  onConfigureEndpoint = () => {},
  onConfigureCustomLang = () => {},
  endpointStatuses = {},
  modelCapabilities = {},
  wand = null,
  defaultModel = '',
  defaultThinkingLevel = Debate.DEFAULT_THINKING_LEVEL,
  providerThinkingLevels = {},
}) {
  const UI_STRINGS = useUiStrings()
  const ui = UI_STRINGS.participants
  const common = UI_STRINGS.common
  const reasoningLangOptions = [
    { value: '', label: ui.reasoningLangSameAsOutput },
    { value: Debate.REASONING_LANG_CUSTOM, label: ui.reasoningLangCustom },
    ...UI_LANGUAGE_OPTIONS.map(language => ({ value: language.code, label: language.label, code: language.code })),
  ]
  // Same shape as the model picker: the first entry is the default, so
  // following it is a choice on the list rather than the absence of one. The
  // default shown is the one of the participant's own provider, which is the
  // one the turn will actually run with.
  const thinkingChoicesFor = participant => {
    const level = Debate.providerThinkingLevel(participant?.providerId, { defaultProviderId, defaultThinkingLevel, providerThinkingLevels })
    const inherit = { value: Debate.INHERIT_THINKING_LEVEL, label: `${ui.useDefaultThinking} · ${thinkingLevelLabel(ui, level)}` }
    return { inherit, choices: [inherit, ...thinkingLevelOptions(ui)] }
  }
  // "No level" is stored as null and travels as '' here, the way it did when
  // this was a native select whose first option had an empty value.
  const educationOptions = educationLevels.map(level => ({ value: level.value ?? '', label: level.label }))
  // The one picker on the row that has to fill the space left between the age
  // slider and the toggles, instead of the fixed 170px the others take.
  const growingSelectStyles = {
    ...moodSelectStyles,
    container: base => ({ ...moodSelectStyles.container?.(base) ?? base, width: 'auto', flex: '1 1 auto', minWidth: 0 }),
  }
  const describeDraft = draft => [
    draft.mood ? moods.find(mood => mood.id === draft.mood)?.label : null,
    draft.ageGroup != null ? ageGroups[draft.ageGroup]?.label : null,
    draft.educationLevel ? educationLevels.find(level => level.value === draft.educationLevel)?.label : null,
    draft.reasoningLang ? draft.reasoningLang.toUpperCase() : null,
  ].filter(Boolean).join(' · ')

  /**
   * Replaces the persona. Picking a candidate swaps the whole character, so
   * the previous traits are dropped rather than merged — keeping them would
   * blend two personas into one. Model, endpoint and affinities are untouched.
   */
  const applyDraft = (idx, draft) => setParticipants(prev => prev.map((x, i) => {
    if (i !== idx) return x

    // Constraints the user marked as high priority are deliberate overrides,
    // so those survive the swap while the generated traits are replaced.
    const kept = Debate.normalizeParticipantConstraints(x.constraints).filter(entry => entry.override)
    const generated = (draft.traits || []).map(trait => ({ text: trait, override: false }))

    return {
      ...x,
      name: draft.name || x.name,
      constraints: [...kept, ...generated],
      ...(draft.ageGroup != null ? { ageGroup: draft.ageGroup } : {}),
      ...(draft.educationLevel ? { educationLevel: draft.educationLevel } : {}),
      ...(draft.mood ? { mood: draft.mood } : {}),
      ...(draft.moodIntensity != null ? { moodIntensity: draft.moodIntensity } : {}),
      ...(Object.prototype.hasOwnProperty.call(draft, 'responseLength') ? { responseLength: draft.responseLength } : {}),
      ...(draft.reasoningLang ? { reasoningLang: draft.reasoningLang } : {}),
    }
  }))

  const moderatorModeOptions = [
    { value: 'containment', label: ui.moderatorModeContainment },
    { value: 'facilitator', label: ui.moderatorModeFacilitator },
    { value: 'active', label: ui.moderatorModeActive },
  ]
  const [dragSrcIdx, setDragSrcIdx] = useState(null)
  const [dragOver, setDragOver] = useState(null) // index being hovered
  const [collapsed, setCollapsed] = useState(() => Object.fromEntries(participants.map((_, i) => [i, true])))

  const handleDragStart = (e, idx) => {
    setDragSrcIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e, idx) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (idx !== dragSrcIdx) setDragOver(idx)
  }

  const handleDrop = (e, toIdx) => {
    e.preventDefault()
    const fromIdx = dragSrcIdx
    if (fromIdx === null || fromIdx === toIdx) { setDragOver(null); return }

    setParticipants(prev => {
      return Debate.reorderParticipants(prev, fromIdx, toIdx)
    })

    setDragSrcIdx(null)
    setDragOver(null)
  }

  const handleDragEnd = () => {
    setDragSrcIdx(null)
    setDragOver(null)
  }

  const hasCollapsedParticipants = participants.some((_, i) => collapsed[i] !== false)
  const toggleAllLabel = hasCollapsedParticipants ? ui.expandAll : ui.collapseAll
  const toggleAllParticipants = () => {
    const nextCollapsed = !hasCollapsedParticipants
    setCollapsed(Object.fromEntries(participants.map((_, i) => [i, nextCollapsed])))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ borderTop: '1px solid var(--c-242424, #242424)', margin: '2px 0 0' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0 4px', gap: 8 }}>
        {/* The two resets are one pair and stay side by side; only the
            expand/collapse toggle sits at the far end of the row. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            style={{ ...styles.connectBtn(running), padding: '3px 10px', fontSize: 11 }}
            onClick={onResetAffinities}
            disabled={running}
          >
            {ui.resetAffinities}
          </button>
          <button
            style={{ ...styles.connectBtn(running || !participants.some(participant => participant.providerId || participant.endpointOverride)), padding: '3px 10px', fontSize: 11 }}
            onClick={onResetProviders}
            disabled={running || !participants.some(participant => participant.providerId || participant.endpointOverride)}
            title={ui.resetProvidersTitle}
          >
            {ui.resetProviders}
          </button>
        </div>
        <button
          style={{ ...styles.connectBtn(false), padding: '3px 10px', fontSize: 11 }}
          onClick={toggleAllParticipants}
        >
          {toggleAllLabel}
        </button>
      </div>
      {participants.map((p, idx) => {
        const isCollapsed = collapsed[idx] !== false
        const localUser = !!p.localUser || p.model === userModel
        const characterLabel = characterTypes.find(ct => (p.characterType ?? null) === ct.value)?.label ?? ui.person
        const responseLabel = `${ui.verbosity}: ${responseLengths.find(rl => (p.responseLength ?? null) === rl.value)?.label ?? ui.free}`
        const moodLabel = localUser ? ui.user : (moods.find(m => m.id === p.mood)?.label ?? ui.neutral)
        const moodDegreeLabel = moodIntensity[p.moodIntensity ?? defaultMoodIntensity]?.label ?? ''
        const moodBadgeLabel = localUser ? moodLabel : `${moodLabel} (${moodDegreeLabel})`
        const ageLabel = ageGroups[p.ageGroup ?? defaultAgeGroup]?.label ?? '-'
        const permissiveness = Math.min(4, Math.max(0, Math.round(Number.isFinite(Number(p.moderatorPermissiveness)) ? Number(p.moderatorPermissiveness) : Debate.DEFAULT_MODERATOR_PERMISSIVENESS)))
        const moderatorMode = Debate.normalizeModeratorMode(p)
        const facilitationInterval = normalizeModeratorFacilitationInterval(p.moderatorFacilitationInterval)
        const eduLabel = educationLevels.find(e => e.value === (p.educationLevel ?? null))?.label ?? ui.modelDefault
        const nameLabel = p.name?.trim() || ui.unnamed
        const titleLabel = nameLabel

        return (
          <div key={p.id} style={{ display: 'flex', alignItems: 'stretch', gap: 8, opacity: dragSrcIdx === idx ? 0.4 : 1 }}>
            <div
              title={ui.dragToReorder}
              draggable
              onDragStart={e => handleDragStart(e, idx)}
              onDragEnd={handleDragEnd}
              style={{
                cursor: 'grab',
                color: 'var(--c-454545, #454545)',
                flexShrink: 0,
                width: 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                userSelect: 'none',
              }}
            >
              <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
                <circle cx="3" cy="2.5" r="1.2"/><circle cx="7" cy="2.5" r="1.2"/>
                <circle cx="3" cy="7" r="1.2"/><circle cx="7" cy="7" r="1.2"/>
                <circle cx="3" cy="11.5" r="1.2"/><circle cx="7" cy="11.5" r="1.2"/>
              </svg>
            </div>
            <div
              onDragOver={e => handleDragOver(e, idx)}
              onDrop={e => handleDrop(e, idx)}
              style={{
                flex: 1,
                borderRadius: 8,
                border: dragOver === idx ? '1px dashed var(--c-555555, #555)' : '1px solid var(--c-202020, #202020)',
                padding: 6,
                transition: 'border-color 0.12s',
                background: 'var(--c-111111, #111)',
              }}
            >
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setCollapsed(prev => ({ ...prev, [idx]: !isCollapsed }))
                }}
                title={isCollapsed ? ui.expandParticipant : ui.collapseParticipant}
                style={{
                  ...styles.connectBtn(false),
                  padding: '2px 6px',
                  fontSize: 12,
                  minWidth: 24,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {isCollapsed ? <polyline points="6 9 12 15 18 9" /> : <polyline points="18 15 12 9 6 15" />}
                </svg>
              </button>

              <span style={{ fontSize: 12, fontWeight: 700, color: participantColor(p.label), minWidth: 16, flexShrink: 0 }}>{p.tag}</span>

              <div
                onClick={() => setCollapsed(prev => ({ ...prev, [idx]: !isCollapsed }))}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  minWidth: 0,
                }}
                title={isCollapsed ? ui.expandParticipant : ui.collapseParticipant}
              >
                <span style={{ fontSize: 12, color: 'var(--c-d0d0d0, #d0d0d0)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titleLabel}</span>
                <span style={{ fontSize: 10, color: 'var(--c-888888, #888)', border: '1px solid var(--c-2f2f2f, #2f2f2f)', borderRadius: 999, padding: '1px 7px' }}>{characterLabel}</span>
                <span style={{ fontSize: 10, color: 'var(--c-7acb92, #7acb92)', border: '1px solid var(--c-2a3a2a, #2a3a2a)', borderRadius: 999, padding: '1px 7px' }}>{responseLabel}</span>
                <span style={{ fontSize: 10, color: 'var(--c-9b9b9b, #9b9b9b)', border: '1px solid var(--c-2f2f2f, #2f2f2f)', borderRadius: 999, padding: '1px 7px' }}>{moodBadgeLabel}</span>
                {(p.educationLevel ?? null) !== null && <span style={{ fontSize: 10, color: 'var(--c-8fb9ff, #8fb9ff)', border: '1px solid var(--c-2b3f5f, #2b3f5f)', borderRadius: 999, padding: '1px 7px' }}>{eduLabel}</span>}
                <span style={{ fontSize: 10, color: 'var(--c-d9a95d, #d9a95d)', border: '1px solid var(--c-3a2f1f, #3a2f1f)', borderRadius: 999, padding: '1px 7px' }}>{ageLabel}</span>
                {!!p.endpointOverride?.trim() && <span style={{ fontSize: 10, color: 'var(--c-93c5fd, #93c5fd)', border: '1px solid var(--c-27466a, #27466a)', borderRadius: 999, padding: '1px 7px' }}>{ui.endpointBadge}</span>}
                {p.isModerator && <span style={{ fontSize: 10, color: 'var(--c-ef4444, #ef4444)', border: '1px solid var(--c-5f2b2b, #5f2b2b)', borderRadius: 999, padding: '1px 7px' }}>{common.moderator}</span>}
              </div>

              {participants.length > 2 && (
                <button
                  style={{ ...styles.connectBtn(false), padding: '4px 8px', fontSize: 12, flexShrink: 0 }}
                  onClick={() => onRequestRemoveParticipant(idx)}
                  title={ui.removeParticipant}
                >×</button>
              )}
            </div>

            {!isCollapsed && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(
              <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 3 }}>
                  {characterTypes.map(ct => {
                    const active = (p.characterType ?? null) === ct.value
                    return (
                      <button
                        key={String(ct.value)}
                        onClick={() => setParticipants(prev => prev.map((x, i) => i === idx ? { ...x, characterType: ct.value } : x))}
                        style={{
                          fontSize: 10, padding: '2px 8px', borderRadius: 4, border: '1px solid',
                          cursor: 'pointer',
                          background: active ? 'var(--c-2e1f4f, #2e1f4f)' : 'transparent',
                          borderColor: active ? 'var(--c-a78bfa, #a78bfa)' : 'var(--c-2a2a2a, #2a2a2a)',
                          color: active ? 'var(--c-a78bfa, #a78bfa)' : 'var(--c-444444, #444)',
                        }}
                      >{ct.label}</button>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', gap: 3 }}>
                  <span style={{ fontSize: 10, color: 'var(--c-666666, #666)', alignSelf: 'center', whiteSpace: 'nowrap', marginRight: 3 }}>{ui.verbosity}:</span>
                  {responseLengths.map(rl => {
                    const active = (p.responseLength ?? null) === rl.value
                    return (
                      <button
                        key={String(rl.value)}
                        onClick={() => setParticipants(prev => prev.map((x, i) => i === idx ? { ...x, responseLength: rl.value } : x))}
                        style={{
                          fontSize: 10, padding: '2px 8px', borderRadius: 4, border: '1px solid',
                          cursor: 'pointer',
                          background: active ? 'var(--c-1a2e1a, #1a2e1a)' : 'transparent',
                          borderColor: active ? 'var(--c-4ade80, #4ade80)' : 'var(--c-2a2a2a, #2a2a2a)',
                          color: active ? 'var(--c-4ade80, #4ade80)' : 'var(--c-444444, #444)',
                        }}
                      >{rl.label}</button>
                    )
                  })}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  style={styles.nameInput}
                  value={p.name}
                  onChange={e => setParticipants(prev => prev.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))}
                  placeholder={ui.namePlaceholder}
                  title={ui.fantasyName}
                  spellCheck={false}
                />
              {wand && (
                <MagicWand
                  wand={wand}
                  mode={participantMode(idx)}
                  describeItem={describeDraft}
                  onPick={draft => applyDraft(idx, draft)}
                />
              )}
              <EndpointModelGroup
                models={providerModels[p.providerId || defaultProviderId] || models}
                providerId={p.providerId || ''}
                defaultProviderId={defaultProviderId}
                model={p.model && p.model !== userModel ? p.model : ''}
                // Picking the general default is picking it whole: the model a
                // participant had on a provider of its own is not the general
                // default of anything, so the provider and its endpoint go with
                // it. Without this the only way back was a model list that no
                // longer contained the general default at all.
                onModelChange={value => setParticipants(prev => prev.map((x, i) => i === idx
                  ? (value ? { ...x, model: value } : { ...x, model: '', providerId: '', endpointOverride: '' })
                  : x))}
                defaultModel={defaultModel}
                endpointOverride={p.endpointOverride}
                endpointState={endpointStatuses?.[p.id]?.state ?? ''}
                onConfigureEndpoint={() => onConfigureEndpoint?.(idx)}
                noOptionsMessage={ui.noModelsAvailable}
              />
              <ReactSelect
                styles={moodSelectStyles}
                options={moodOptions}
                value={moodOptions.find(o => o.value === p.mood) ?? null}
                onChange={opt => setParticipants(prev => prev.map((x, i) => i === idx ? { ...x, mood: opt.value } : x))}
                formatOptionLabel={formatMoodOption}
                isSearchable={false}
                menuPlacement="auto"
                title={ui.participantMood}
              />
              {moods.find(m => m.id === p.mood)?.constraints?.default && (
                <StackedSlider
                  width={96}
                  accent="var(--c-4ade80, #4ade80)"
                  text={draft => moodIntensity[draft].label}
                  title={moodIntensity[p.moodIntensity ?? defaultMoodIntensity].label}
                  min={0} max={4} step={1}
                  value={p.moodIntensity ?? defaultMoodIntensity}
                  onCommit={value => setParticipants(prev => prev.map((x, i) => i === idx ? { ...x, moodIntensity: value } : x))}
                />
              )}
            </div>

            {(
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {/* Only a reported "no" disables it. A model the endpoint could
                    not be asked about leaves the control as it was. */}
                {(() => {
                  const canThink = modelCapabilities[p.id]?.thinking !== false
                  const thinking = thinkingChoicesFor(p)
                  return (
                    <>
                      <span
                        style={{ fontSize: 11, color: canThink ? 'var(--c-666666, #666)' : 'var(--c-3a3a3a, #3a3a3a)', whiteSpace: 'nowrap' }}
                        title={canThink ? ui.thinkingLevelTitle : ui.thinkingUnsupported}
                      >{ui.thinkingLevel}:</span>
                      <div style={{ minWidth: 130 }} title={canThink ? undefined : ui.thinkingUnsupported}>
                        <ReactSelect
                          styles={moodSelectStyles}
                          options={thinking.choices}
                          isDisabled={!canThink}
                          placeholder={ui.thinkingUnsupportedShort}
                          value={canThink
                            ? (thinking.choices.find(o => o.value === Debate.normalizeThinkingLevelChoice(p.thinkingLevel)) ?? thinking.inherit)
                            : null}
                          onChange={opt => setParticipants(prev => prev.map((x, i) => i === idx ? { ...x, thinkingLevel: opt?.value ?? Debate.INHERIT_THINKING_LEVEL } : x))}
                          menuPlacement="auto"
                        />
                      </div>
                    </>
                  )
                })()}
                <span style={{ fontSize: 11, color: 'var(--c-666666, #666)', whiteSpace: 'nowrap' }} title={ui.reasoningLangTitle}>{ui.thinkingLanguage}:</span>
                <div style={{ minWidth: 170 }}>
                  <ReactSelect
                    styles={moodSelectStyles}
                    options={reasoningLangOptions}
                    value={(() => {
                      const selected = reasoningLangOptions.find(o => o.value === (p.reasoningLang || '')) ?? reasoningLangOptions[0]
                      // Show what was typed rather than the generic "Other" entry.
                      return selected.value === Debate.REASONING_LANG_CUSTOM && p.reasoningLangCustom?.trim()
                        ? { ...selected, label: p.reasoningLangCustom.trim() }
                        : selected
                    })()}
                    onChange={opt => {
                      const value = opt?.value ?? ''
                      setParticipants(prev => prev.map((x, i) => i === idx ? { ...x, reasoningLang: value } : x))
                      if (value === Debate.REASONING_LANG_CUSTOM) onConfigureCustomLang?.(idx)
                    }}
                    formatOptionLabel={opt => opt.code ? formatLanguageLabel(opt) : opt.label}
                    menuPlacement="auto"
                  />
                </div>
                {p.reasoningLang === Debate.REASONING_LANG_CUSTOM && (
                  <button
                    onClick={() => onConfigureCustomLang?.(idx)}
                    title={ui.reasoningLangCustomEdit}
                    aria-label={ui.reasoningLangCustomEdit}
                    style={{
                      width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                      border: '1px solid var(--c-4a2f63, #4a2f63)', background: 'var(--c-1f1726, #1f1726)', color: 'var(--c-caa9ee, #caa9ee)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                  </button>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} title={ui.thinkingLanguageSkipTranslationTitle}>
                  <span style={{ fontSize: 11, color: p.reasoningLangSkipTranslation ? 'var(--c-c084fc, #c084fc)' : 'var(--c-666666, #666)', whiteSpace: 'nowrap' }}>{ui.thinkingLanguageSkipTranslation}</span>
                  <div
                    onClick={() => setParticipants(prev => prev.map((x, i) => i === idx ? { ...x, reasoningLangSkipTranslation: !x.reasoningLangSkipTranslation } : x))}
                    role="switch"
                    aria-checked={!!p.reasoningLangSkipTranslation}
                    style={{
                      width: 34, height: 18, borderRadius: 9, position: 'relative',
                      background: p.reasoningLangSkipTranslation ? 'var(--c-c084fc, #c084fc)' : 'var(--c-444444, #444)',
                      transition: 'background 0.2s',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: 2, left: p.reasoningLangSkipTranslation ? 18 : 2,
                      width: 14, height: 14, borderRadius: '50%', background: '#fff',
                      transition: 'left 0.2s',
                    }} />
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <>
                <StackedSlider
                  width={110}
                  text={draft => `${ui.age}: ${ageGroups[draft]?.label}`}
                  color={draft => (draft === defaultAgeGroup ? 'var(--c-555555, #555)' : 'var(--c-f59e0b, #f59e0b)')}
                  title={ui.ageTitle(ageGroups[p.ageGroup ?? defaultAgeGroup]?.label)}
                  min={0} max={4} step={1}
                  value={p.ageGroup ?? defaultAgeGroup}
                  onCommit={value => setParticipants(prev => prev.map((x, i) => i === idx ? { ...x, ageGroup: value } : x))}
                />
                {/* The last native select on the row: it kept the browser's own
                    control, arrow and menu next to react-select neighbours that
                    are 1px shorter and open a styled list. */}
                <ReactSelect
                  styles={growingSelectStyles}
                  options={educationOptions}
                  value={educationOptions.find(option => option.value === (p.educationLevel ?? '')) ?? educationOptions[0] ?? null}
                  onChange={option => setParticipants(prev => prev.map((x, i) => i === idx ? { ...x, educationLevel: option?.value || null } : x))}
                  isSearchable={false}
                  menuPlacement="auto"
                  title={ui.educationTitle}
                />
                <TemperatureSlider
                  value={p.temperature}
                  levels={ui.temperatureLevels}
                  title={`${ui.temperatureTitle} ${ui.temperatureResetHint}`}
                  onCommit={temperature => setParticipants(prev => prev.map((x, i) => i === idx ? { ...x, temperature } : x))}
                />
                </>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} title={ui.localUserTitle}>
                  <span style={{ fontSize: 11, color: localUser ? 'var(--c-22d3ee, #22d3ee)' : 'var(--c-666666, #666)', whiteSpace: 'nowrap' }}>{ui.localUser}</span>
                  <div
                    onClick={() => setParticipants(prev => prev.map((x, i) => i === idx
                      ? {
                          ...x,
                          localUser: !(x.localUser || x.model === userModel),
                          ...(x.model === userModel ? { model: defaultModel || '' } : {}),
                        }
                      : x))}
                    role="switch"
                    aria-checked={localUser}
                    style={{
                      width: 34, height: 18, borderRadius: 9, position: 'relative',
                      background: localUser ? 'var(--c-22d3ee, #22d3ee)' : 'var(--c-444444, #444)',
                      transition: 'background 0.2s', cursor: 'pointer',
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: 2, left: localUser ? 18 : 2,
                      width: 14, height: 14, borderRadius: '50%', background: '#fff',
                      transition: 'left 0.2s',
                    }} />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} title={ui.moderatorRole}>
                  <span style={{ fontSize: 11, color: p.isModerator ? 'var(--c-22d3ee, #22d3ee)' : 'var(--c-666666, #666)', whiteSpace: 'nowrap' }}>{common.moderator}</span>
                <div
                  onClick={() => setParticipants(prev => prev.map((x, i) => i === idx ? { ...x, isModerator: !x.isModerator } : x))}
                  role="switch"
                  aria-checked={!!p.isModerator}
                  style={{
                    width: 34, height: 18, borderRadius: 9, position: 'relative',
                    background: p.isModerator ? 'var(--c-22d3ee, #22d3ee)' : 'var(--c-444444, #444)',
                    transition: 'background 0.2s',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{
                    position: 'absolute', top: 2, left: p.isModerator ? 18 : 2,
                    width: 14, height: 14, borderRadius: '50%', background: '#fff',
                    transition: 'left 0.2s',
                  }} />
                </div>
                </div>
                </div>
            </div>

             {p.isModerator && (
                 <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', paddingLeft: 2 }}>
                 <StackedSlider
                   width={150}
                   accent="var(--c-fb923c, #fb923c)"
                   color="var(--c-fb923c, #fb923c)"
                   text={draft => `${ui.moderatorPermissiveness}: ${ui.moderatorPermissivenessLevels[draft]}`}
                   title={ui.moderatorPermissivenessTitle(ui.moderatorPermissivenessLevels[permissiveness])}
                   min={0} max={4} step={1}
                   value={permissiveness}
                   onCommit={value => setParticipants(prev => prev.map((x, i) => i === idx ? { ...x, moderatorPermissiveness: value } : x))}
                 />
                 <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} title={ui.moderatorModeTitle}>
                  <span style={{ fontSize: 11, color: 'var(--c-fb923c, #fb923c)', whiteSpace: 'nowrap' }}>{ui.moderatorModeLabel}</span>
                  <div style={{ minWidth: 150 }}>
                    <ReactSelect
                      styles={moodSelectStyles}
                      options={moderatorModeOptions}
                      value={moderatorModeOptions.find(o => o.value === moderatorMode) ?? moderatorModeOptions[0]}
                      onChange={opt => setParticipants(prev => prev.map((x, i) => i === idx ? { ...x, moderatorMode: opt.value } : x))}
                      isSearchable={false}
                      menuPlacement="auto"
                    />
                  </div>
                </div>

                {/* Only the facilitator style runs on a schedule, so the
                    cadence is meaningless for the other two. */}
                {moderatorMode === 'facilitator' && (
                  <StackedSlider
                    width={150}
                    accent="var(--c-fb923c, #fb923c)"
                    color="var(--c-fb923c, #fb923c)"
                    text={draft => `${ui.moderatorFacilitationInterval}: ${ui.moderatorFacilitationIntervalValue(draft)}`}
                    title={ui.moderatorFacilitationIntervalTitle}
                    min={MIN_MODERATOR_FACILITATION_INTERVAL}
                    max={MAX_MODERATOR_FACILITATION_INTERVAL}
                    step={1}
                    value={facilitationInterval}
                    onCommit={value => setParticipants(prev => prev.map((x, i) => i === idx ? { ...x, moderatorFacilitationInterval: value } : x))}
                  />
                )}
              </div>
            )}

            {(
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {(p.constraints ?? []).map((rawConstraint, ci) => {
                  const constraint = typeof rawConstraint === 'string' ? rawConstraint : rawConstraint?.text ?? ''
                  const isOverride = typeof rawConstraint === 'object' && !!rawConstraint?.override
                  return (
                  <div
                    key={`${p.id}-${ci}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      background: isOverride ? 'var(--c-2a1f10, #2a1f10)' : 'var(--c-1f1726, #1f1726)',
                      border: isOverride ? '1px solid var(--c-7a5a1f, #7a5a1f)' : '1px solid var(--c-4a2f63, #4a2f63)',
                      borderRadius: 6,
                      padding: '2px 7px',
                      fontSize: 10,
                      color: isOverride ? 'var(--c-f0c060, #f0c060)' : 'var(--c-caa9ee, #caa9ee)',
                      maxWidth: 360,
                    }}
                    title={isOverride ? `${ui.overrideConstraintBadge} — ${constraint}` : constraint}
                    >
                    {isOverride && <span style={{ fontSize: 10, lineHeight: 1 }} title={ui.overrideConstraintBadge}>⚡</span>}
                    <button
                      onClick={() => onEditConstraint(idx, ci)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'inherit',
                        cursor: 'pointer',
                        padding: 0,
                        margin: 0,
                        fontSize: 10,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: 280,
                        textAlign: 'left',
                      }}
                      title={ui.editConstraint}
                    >
                      {constraint}
                    </button>
                    <RemoveButton
                      onClick={() => onDeleteConstraint(idx, ci)}
                      title={ui.removeConstraint}
                      color={isOverride ? 'var(--c-a8823f, #a8823f)' : 'var(--c-7f629d, #7f629d)'}
                      size={12}
                    />
                  </div>
                  )
                })}
                <button
                  style={{ ...styles.connectBtn(false), padding: '2px 8px', fontSize: 11, flexShrink: 0 }}
                  title={ui.addConstraint}
                  onClick={() => onAddConstraint(idx)}
                >
                  {ui.addConstraintButton}
                </button>
              </div>
            )}

            {(
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ fontSize: 11, color: 'var(--c-666666, #666)' }}>{ui.relationalAffinity}</span>
                  {p.isModerator && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} title={ui.moderatorDynamicAffinityTitle}>
                      <span style={{ fontSize: 11, color: p.moderatorDynamicAffinity ? 'var(--c-22d3ee, #22d3ee)' : 'var(--c-666666, #666)', whiteSpace: 'nowrap' }}>{ui.moderatorDynamicAffinity}</span>
                      <div
                        onClick={() => setParticipants(prev => prev.map((x, i) => i === idx ? { ...x, moderatorDynamicAffinity: !x.moderatorDynamicAffinity } : x))}
                        role="switch"
                        aria-checked={!!p.moderatorDynamicAffinity}
                        style={{
                          width: 34, height: 18, borderRadius: 9, position: 'relative',
                          background: p.moderatorDynamicAffinity ? 'var(--c-22d3ee, #22d3ee)' : 'var(--c-444444, #444)',
                          transition: 'background 0.2s', cursor: 'pointer',
                        }}
                      >
                        <div style={{
                          position: 'absolute', top: 2, left: p.moderatorDynamicAffinity ? 18 : 2,
                          width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
                        }} />
                      </div>
                    </div>
                  )}
                </div>
                {participants.filter(x => x.id !== p.id).map(other => {
                  const rawW = Number((p.affinity && typeof p.affinity === 'object') ? (p.affinity[other.id] ?? 0) : 0)
                  const w = Number.isFinite(rawW) ? rawW : 0
                  const locked = !!(p.affinityLocks && typeof p.affinityLocks === 'object' ? p.affinityLocks[other.id] : false)
                  return (
                    <div key={`${p.id}-aff-${other.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 90, flexShrink: 0, fontSize: 11, color: 'var(--c-888888, #888)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={other.name || other.tag}>{other.name || other.tag}</span>
                      <span style={{ fontSize: 10, color: 'var(--c-8a8a8a, #8a8a8a)', width: 16, textAlign: 'center' }}>−</span>
                      <input
                        type="range"
                        min={-1}
                        max={1}
                        step={0.05}
                        value={w}
                        onChange={e => {
                          const nextW = Number(e.target.value)
                          setParticipants(prev => prev.map((x, i) => {
                            if (i !== idx) return x
                            const map = { ...(x.affinity && typeof x.affinity === 'object' ? x.affinity : {}) }
                            const locks = { ...(x.affinityLocks && typeof x.affinityLocks === 'object' ? x.affinityLocks : {}) }
                            if (nextW === 0) delete map[other.id]
                            else map[other.id] = Math.round(nextW * 100) / 100
                            return { ...x, affinity: map, affinityLocks: locks }
                          }))
                        }}
                        style={{
                          flex: 1,
                          accentColor: w > 0 ? 'var(--c-22c55e, #22c55e)' : w < 0 ? 'var(--c-ef4444, #ef4444)' : 'var(--c-71717a, #71717a)',
                          background: 'linear-gradient(90deg, var(--c-ef4444, #ef4444) 0%, var(--c-71717a, #71717a) 50%, var(--c-22c55e, #22c55e) 100%)',
                          height: 4,
                          borderRadius: 999,
                          cursor: 'pointer',
                        }}
                        title={`${ui.relationTitle(other.name || other.tag)}: ${w.toFixed(2)}`}
                      />
                      <span style={{ fontSize: 10, color: 'var(--c-8a8a8a, #8a8a8a)', width: 16, textAlign: 'center' }}>+</span>
                      <span style={{ minWidth: 86, fontSize: 11, color: w > 0 ? 'var(--c-4ade80, #4ade80)' : w < 0 ? 'var(--c-f87171, #f87171)' : 'var(--c-777777, #777)' }}>
                        {w.toFixed(2)} {w > 0 ? ui.affinity : w < 0 ? ui.conflict : ui.neutral}
                      </span>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: locked ? 'var(--c-f59e0b, #f59e0b)' : 'var(--c-777777, #777)', whiteSpace: 'nowrap' }} title={ui.lockTitle}>
                        <input
                          type="checkbox"
                          checked={locked}
                          onChange={e => {
                            const on = e.target.checked
                            setParticipants(prev => prev.map((x, i) => {
                              if (i !== idx) return x
                              const locks = { ...(x.affinityLocks && typeof x.affinityLocks === 'object' ? x.affinityLocks : {}) }
                              if (on) locks[other.id] = true
                              else delete locks[other.id]
                              return { ...x, affinityLocks: locks }
                            }))
                          }}
                        />
                        {ui.lockLabel}
                      </label>
                    </div>
                  )
                })}
              </div>
            )}
              </div>
            )}
          </div>
          </div>
        )
      })}
      {participants.length < palette.length && (
        <button
          style={{ ...styles.connectBtn(false), alignSelf: 'flex-start', fontSize: 12 }}
          onClick={() => setParticipants(prev => [...prev, mkParticipant(prev.length, '')])}
        >{ui.addParticipant}</button>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '2px 0 2px' }}>
        <button
          style={{ ...styles.connectBtn(false), padding: '3px 10px', fontSize: 11 }}
          onClick={toggleAllParticipants}
        >
          {toggleAllLabel}
        </button>
      </div>
      <div style={{ borderTop: '1px solid var(--c-242424, #242424)', margin: '2px 0 0' }} />
    </div>
  )
}
