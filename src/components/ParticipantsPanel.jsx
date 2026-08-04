import { useState } from 'react'
import { styles } from './Style'
import ReactSelect from 'react-select'
import { UI_LANGUAGE_OPTIONS, formatLanguageLabel } from '../i18n/UiStrings'
import { useUiStrings } from '../i18n/UiStringsContext'
import { Debate } from '../debate/Debate'
import { participantMode } from '../services/Suggestions'
import MagicWand from './MagicWand'

export default function ParticipantsPanel({
  participants,
  setParticipants,
  userModel,
  characterTypes,
  responseLengths,
  modelSelectStyles,
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
  palette,
  mkParticipant,
  running,
  onResetAffinities,
  onAddConstraint,
  onEditConstraint,
  onDeleteConstraint,
  onRequestRemoveParticipant,
  onConfigureEndpoint = () => {},
  endpointStatuses = {},
  wand = null,
  defaultModel = '',
}) {
  const UI_STRINGS = useUiStrings()
  const ui = UI_STRINGS.participants
  const common = UI_STRINGS.common
  const reasoningLangOptions = [
    { value: '', label: ui.reasoningLangSameAsOutput },
    { value: Debate.REASONING_LANG_FROM_CONSTRAINT, label: ui.reasoningLangFromConstraint },
    ...UI_LANGUAGE_OPTIONS.map(language => ({ value: language.code, label: language.label, code: language.code })),
  ]
  const thinkingLevelOptions = [
    { value: 'none', label: ui.thinkingNone },
    { value: 'low', label: ui.thinkingLow },
    { value: 'medium', label: ui.thinkingMedium },
    { value: 'high', label: ui.thinkingHigh },
    { value: 'max', label: ui.thinkingMax },
  ]
  // An empty model already means "fall back to the default"; this makes that
  // state an explicit choice instead of something reachable only by clearing.
  const defaultModelOption = {
    value: '',
    label: defaultModel ? `${ui.useDefaultModel} · ${defaultModel}` : ui.useDefaultModelUnset,
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
      <div style={{ borderTop: '1px solid #242424', margin: '2px 0 0' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0 4px', gap: 8 }}>
        <button
          style={{ ...styles.connectBtn(running), padding: '3px 10px', fontSize: 11 }}
          onClick={onResetAffinities}
          disabled={running}
        >
          {ui.resetAffinities}
        </button>
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
                color: '#454545',
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
                border: dragOver === idx ? '1px dashed #555' : '1px solid #202020',
                padding: 6,
                transition: 'border-color 0.12s',
                background: '#111',
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

              <span style={{ fontSize: 12, fontWeight: 700, color: p.label, minWidth: 16, flexShrink: 0 }}>{p.tag}</span>

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
                <span style={{ fontSize: 12, color: '#d0d0d0', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titleLabel}</span>
                <span style={{ fontSize: 10, color: '#888', border: '1px solid #2f2f2f', borderRadius: 999, padding: '1px 7px' }}>{characterLabel}</span>
                <span style={{ fontSize: 10, color: '#7acb92', border: '1px solid #2a3a2a', borderRadius: 999, padding: '1px 7px' }}>{responseLabel}</span>
                <span style={{ fontSize: 10, color: '#9b9b9b', border: '1px solid #2f2f2f', borderRadius: 999, padding: '1px 7px' }}>{moodBadgeLabel}</span>
                {(p.educationLevel ?? null) !== null && <span style={{ fontSize: 10, color: '#8fb9ff', border: '1px solid #2b3f5f', borderRadius: 999, padding: '1px 7px' }}>{eduLabel}</span>}
                <span style={{ fontSize: 10, color: '#d9a95d', border: '1px solid #3a2f1f', borderRadius: 999, padding: '1px 7px' }}>{ageLabel}</span>
                {!!p.endpointOverride?.trim() && <span style={{ fontSize: 10, color: '#93c5fd', border: '1px solid #27466a', borderRadius: 999, padding: '1px 7px' }}>{ui.endpointBadge}</span>}
                {p.isModerator && <span style={{ fontSize: 10, color: '#ef4444', border: '1px solid #5f2b2b', borderRadius: 999, padding: '1px 7px' }}>{common.moderator}</span>}
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
                          background: active ? '#2e1f4f' : 'transparent',
                          borderColor: active ? '#a78bfa' : '#2a2a2a',
                          color: active ? '#a78bfa' : '#444',
                        }}
                      >{ct.label}</button>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', gap: 3 }}>
                  <span style={{ fontSize: 10, color: '#666', alignSelf: 'center', whiteSpace: 'nowrap', marginRight: 3 }}>{ui.verbosity}:</span>
                  {responseLengths.map(rl => {
                    const active = (p.responseLength ?? null) === rl.value
                    return (
                      <button
                        key={String(rl.value)}
                        onClick={() => setParticipants(prev => prev.map((x, i) => i === idx ? { ...x, responseLength: rl.value } : x))}
                        style={{
                          fontSize: 10, padding: '2px 8px', borderRadius: 4, border: '1px solid',
                          cursor: 'pointer',
                          background: active ? '#1a2e1a' : 'transparent',
                          borderColor: active ? '#4ade80' : '#2a2a2a',
                          color: active ? '#4ade80' : '#444',
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
                  value={p.model && p.model !== userModel ? { value: p.model, label: p.model } : defaultModelOption}
                  onChange={opt => setParticipants(prev => prev.map((x, i) => i === idx ? { ...x, model: opt?.value ?? '' } : x))}
                  placeholder={common.chooseModel}
                  menuPlacement="auto"
                  noOptionsMessage={() => ui.noModelsAvailable}
                />
              </div>
              {(() => {
                const st = endpointStatuses?.[p.id]?.state ?? 'none'
                const hasOverride = !!p.endpointOverride?.trim()
                const dot = st === 'ok' ? '#4ade80' : st === 'err' ? '#f87171' : st === 'checking' ? '#f59e0b' : '#666'
                const title = hasOverride
                  ? ui.customEndpointTitle(p.endpointOverride, st)
                  : ui.configureCustomEndpoint
                return (
                  <button
                    onClick={() => onConfigureEndpoint?.(idx)}
                    title={title}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      border: `1px solid ${hasOverride ? '#2f4f6f' : '#2e2e2e'}`,
                      background: hasOverride ? '#152131' : '#161616',
                      color: hasOverride ? '#9ac8ff' : '#666',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      flexShrink: 0,
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/>
                      <path d="M2 12h20"/>
                      <path d="M12 2c3 3 4 6 4 10s-1 7-4 10c-3-3-4-6-4-10s1-7 4-10z"/>
                    </svg>
                    <span style={{ position: 'absolute', right: 2, top: 2, width: 6, height: 6, borderRadius: '50%', background: dot, boxShadow: '0 0 0 1px #111' }} />
                  </button>
                )
              })()}
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
              {moods.find(m => m.id === p.mood)?.instruction && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0 }} title={moodIntensity[p.moodIntensity ?? defaultMoodIntensity].label}>
                  <span style={{ fontSize: 10, color: '#555', whiteSpace: 'nowrap' }}>
                    {moodIntensity[p.moodIntensity ?? defaultMoodIntensity].label}
                  </span>
                  <input
                    type="range" min={0} max={4} step={1}
                    value={p.moodIntensity ?? defaultMoodIntensity}
                    onChange={e => setParticipants(prev => prev.map((x, i) => i === idx ? { ...x, moodIntensity: Number(e.target.value) } : x))}
                    style={{ width: 72, accentColor: '#4ade80', cursor: 'pointer' }}
                  />
                </div>
              )}
            </div>

            {(
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: '#666', whiteSpace: 'nowrap' }} title={ui.thinkingLevelTitle}>{ui.thinkingLevel}:</span>
                <div style={{ minWidth: 130 }}>
                  <ReactSelect
                    styles={moodSelectStyles}
                    options={thinkingLevelOptions}
                    value={thinkingLevelOptions.find(o => o.value === Debate.normalizeThinkingLevel(p.thinkingLevel)) ?? thinkingLevelOptions[0]}
                    onChange={opt => setParticipants(prev => prev.map((x, i) => i === idx ? { ...x, thinkingLevel: opt?.value ?? Debate.DEFAULT_THINKING_LEVEL } : x))}
                    menuPlacement="auto"
                  />
                </div>
                <span style={{ fontSize: 11, color: '#666', whiteSpace: 'nowrap' }} title={ui.reasoningLangTitle}>{ui.thinkingLanguage}:</span>
                <div style={{ minWidth: 170 }}>
                  <ReactSelect
                    styles={moodSelectStyles}
                    options={reasoningLangOptions}
                    value={reasoningLangOptions.find(o => o.value === (p.reasoningLang || '')) ?? reasoningLangOptions[0]}
                    onChange={opt => setParticipants(prev => prev.map((x, i) => i === idx ? { ...x, reasoningLang: opt?.value ?? '' } : x))}
                    formatOptionLabel={opt => opt.code ? formatLanguageLabel(opt) : opt.label}
                    menuPlacement="auto"
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} title={ui.thinkingLanguageSkipTranslationTitle}>
                  <span style={{ fontSize: 11, color: p.reasoningLangSkipTranslation ? '#c084fc' : '#666', whiteSpace: 'nowrap' }}>{ui.thinkingLanguageSkipTranslation}</span>
                  <div
                    onClick={() => setParticipants(prev => prev.map((x, i) => i === idx ? { ...x, reasoningLangSkipTranslation: !x.reasoningLangSkipTranslation } : x))}
                    role="switch"
                    aria-checked={!!p.reasoningLangSkipTranslation}
                    style={{
                      width: 34, height: 18, borderRadius: 9, position: 'relative',
                      background: p.reasoningLangSkipTranslation ? '#c084fc' : '#444',
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

            {(
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, color: '#666' }}>{ui.relationalAffinity}</span>
                {participants.filter(x => x.id !== p.id).map(other => {
                  const rawW = Number((p.affinity && typeof p.affinity === 'object') ? (p.affinity[other.id] ?? 0) : 0)
                  const w = Number.isFinite(rawW) ? rawW : 0
                  const locked = !!(p.affinityLocks && typeof p.affinityLocks === 'object' ? p.affinityLocks[other.id] : false)
                  return (
                    <div key={`${p.id}-aff-${other.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 90, flexShrink: 0, fontSize: 11, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={other.name || other.tag}>{other.name || other.tag}</span>
                      <span style={{ fontSize: 10, color: '#8a8a8a', width: 16, textAlign: 'center' }}>−</span>
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
                          accentColor: w > 0 ? '#22c55e' : w < 0 ? '#ef4444' : '#71717a',
                          background: 'linear-gradient(90deg, #ef4444 0%, #71717a 50%, #22c55e 100%)',
                          height: 4,
                          borderRadius: 999,
                          cursor: 'pointer',
                        }}
                        title={`${ui.relationTitle(other.name || other.tag)}: ${w.toFixed(2)}`}
                      />
                      <span style={{ fontSize: 10, color: '#8a8a8a', width: 16, textAlign: 'center' }}>+</span>
                      <span style={{ minWidth: 86, fontSize: 11, color: w > 0 ? '#4ade80' : w < 0 ? '#f87171' : '#777' }}>
                        {w.toFixed(2)} {w > 0 ? ui.affinity : w < 0 ? ui.conflict : ui.neutral}
                      </span>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: locked ? '#f59e0b' : '#777', whiteSpace: 'nowrap' }} title={ui.lockTitle}>
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

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, color: '#666', whiteSpace: 'nowrap' }}>{ui.age}:</span>
                  <input
                    type="range" min={0} max={4} step={1}
                    value={p.ageGroup ?? defaultAgeGroup}
                    onChange={e => setParticipants(prev => prev.map((x, i) => i === idx ? { ...x, ageGroup: Number(e.target.value) } : x))}
                    style={{ width: 72, accentColor: '#f59e0b', cursor: 'pointer' }}
                    title={ui.ageTitle(ageGroups[p.ageGroup ?? defaultAgeGroup]?.label)}
                  />
                  <span style={{ fontSize: 11, color: (p.ageGroup ?? defaultAgeGroup) === defaultAgeGroup ? '#555' : '#f59e0b', minWidth: 70 }}>
                    {ageGroups[p.ageGroup ?? defaultAgeGroup]?.label}
                  </span>
                </div>
                <select
                  value={p.educationLevel ?? ''}
                  onChange={e => setParticipants(prev => prev.map((x, i) => i === idx ? { ...x, educationLevel: e.target.value || null } : x))}
                  style={{
                    flex: '1 1 auto',
                    minWidth: 0,
                    height: 28,
                    background: '#0f0f0f',
                    color: '#aaa',
                    border: '1px solid #2e2e2e',
                    borderRadius: 6,
                    padding: '0 8px',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                  title={ui.educationTitle}
                >
                  {educationLevels.map(e => <option key={e.value ?? ''} value={e.value ?? ''}>{e.label}</option>)}
                </select>
                </>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} title={ui.localUserTitle}>
                  <span style={{ fontSize: 11, color: localUser ? '#22d3ee' : '#666', whiteSpace: 'nowrap' }}>{ui.localUser}</span>
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
                      background: localUser ? '#22d3ee' : '#444',
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
                  <span style={{ fontSize: 11, color: p.isModerator ? '#22d3ee' : '#666', whiteSpace: 'nowrap' }}>{common.moderator}</span>
                <div
                  onClick={() => setParticipants(prev => prev.map((x, i) => i === idx ? { ...x, isModerator: !x.isModerator } : x))}
                  role="switch"
                  aria-checked={!!p.isModerator}
                  style={{
                    width: 34, height: 18, borderRadius: 9, position: 'relative',
                    background: p.isModerator ? '#22d3ee' : '#444',
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
                 <div style={{ display: 'flex', alignItems: 'center', gap: 7 }} title={ui.moderatorPermissivenessTitle(ui.moderatorPermissivenessLevels[permissiveness])}>
                   <span style={{ fontSize: 11, color: '#fb923c', whiteSpace: 'nowrap' }}>{ui.moderatorPermissiveness}</span>
                   <input
                     type="range"
                     min={0}
                     max={4}
                     step={1}
                     value={permissiveness}
                     onChange={e => setParticipants(prev => prev.map((x, i) => i === idx ? { ...x, moderatorPermissiveness: Number(e.target.value) } : x))}
                     style={{ width: 78, accentColor: '#fb923c', cursor: 'pointer' }}
                   />
                   <span style={{ fontSize: 11, color: '#fb923c', minWidth: 76 }}>{ui.moderatorPermissivenessLevels[permissiveness]}</span>
                 </div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} title={ui.moderatorModeTitle}>
                  <span style={{ fontSize: 11, color: '#fb923c', whiteSpace: 'nowrap' }}>{ui.moderatorModeLabel}</span>
                  <div style={{ minWidth: 150 }}>
                    <ReactSelect
                      styles={moodSelectStyles}
                      options={moderatorModeOptions}
                      value={moderatorModeOptions.find(o => o.value === Debate.normalizeModeratorMode(p)) ?? moderatorModeOptions[0]}
                      onChange={opt => setParticipants(prev => prev.map((x, i) => i === idx ? { ...x, moderatorMode: opt.value } : x))}
                      isSearchable={false}
                      menuPlacement="auto"
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexBasis: '100%', flexWrap: 'nowrap', overflowX: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} title={ui.moderatorDynamicAffinityTitle}>
                  <span style={{ fontSize: 11, color: p.moderatorDynamicAffinity ? '#22d3ee' : '#666', whiteSpace: 'nowrap' }}>{ui.moderatorDynamicAffinity}</span>
                  <div
                    onClick={() => setParticipants(prev => prev.map((x, i) => i === idx ? { ...x, moderatorDynamicAffinity: !x.moderatorDynamicAffinity } : x))}
                    role="switch"
                    aria-checked={!!p.moderatorDynamicAffinity}
                    style={{
                      width: 34, height: 18, borderRadius: 9, position: 'relative',
                      background: p.moderatorDynamicAffinity ? '#22d3ee' : '#444',
                      transition: 'background 0.2s', cursor: 'pointer',
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: 2, left: p.moderatorDynamicAffinity ? 18 : 2,
                      width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
                    }} />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} title={ui.moderatorFactCheckTitle}>
                  <span style={{ fontSize: 11, color: p.moderatorFactCheck ? '#facc15' : '#666', whiteSpace: 'nowrap' }}>{ui.moderatorFactCheck}</span>
                  <div
                    onClick={() => setParticipants(prev => prev.map((x, i) => i === idx ? { ...x, moderatorFactCheck: !x.moderatorFactCheck } : x))}
                    role="switch"
                    aria-checked={!!p.moderatorFactCheck}
                    style={{
                      width: 34, height: 18, borderRadius: 9, position: 'relative',
                      background: p.moderatorFactCheck ? '#facc15' : '#444',
                      transition: 'background 0.2s', cursor: 'pointer',
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: 2, left: p.moderatorFactCheck ? 18 : 2,
                      width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
                    }} />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} title={ui.enforceTopicTitle}>
                  <span style={{ fontSize: 11, color: p.moderatorEnforceTopic ? '#4ade80' : '#666', whiteSpace: 'nowrap' }}>{ui.enforceTopic}</span>
                  <div
                    onClick={() => setParticipants(prev => prev.map((x, i) => i === idx ? { ...x, moderatorEnforceTopic: !x.moderatorEnforceTopic } : x))}
                    role="switch"
                    aria-checked={!!p.moderatorEnforceTopic}
                    style={{
                      width: 34, height: 18, borderRadius: 9, position: 'relative',
                      background: p.moderatorEnforceTopic ? '#4ade80' : '#444',
                      transition: 'background 0.2s', cursor: 'pointer',
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: 2, left: p.moderatorEnforceTopic ? 18 : 2,
                      width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
                    }} />
                  </div>
                </div>
                </div>
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
                      background: isOverride ? '#2a1f10' : '#1f1726',
                      border: isOverride ? '1px solid #7a5a1f' : '1px solid #4a2f63',
                      borderRadius: 6,
                      padding: '2px 7px',
                      fontSize: 10,
                      color: isOverride ? '#f0c060' : '#caa9ee',
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
                    <button
                      onClick={() => onDeleteConstraint(idx, ci)}
                      style={{ background: 'none', border: 'none', color: isOverride ? '#a8823f' : '#7f629d', cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1 }}
                      title={ui.removeConstraint}
                    >
                      ✕
                    </button>
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
      <div style={{ borderTop: '1px solid #242424', margin: '2px 0 0' }} />
    </div>
  )
}
