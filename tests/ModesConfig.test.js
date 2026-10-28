import { afterEach, describe, expect, it } from 'vitest'
import { buildSystemPrompt } from '../src/debate/PromptBuilder'
import {
  DEBATE_MODES,
  DEBATE_MODE_CONCLUSION_INSTRUCTIONS,
  DEBATE_MODE_OPTIONS,
  configureModes,
  debateModeLabel,
  getModesConfig,
  normalizeDebateMode,
  resolveModeSettings,
} from '../src/prompts/Modes'
import {
  addModeEntry,
  duplicateModeEntry,
  isModeCustomized,
  moveModeEntry,
  removeModeEntry,
  resetModeEntry,
  toggleModeEntry,
  updateModeEntry,
} from '../src/prompts/ModeEditing'
import { applyAppearance, buildThemeCss, normalizeAppearance, participantColor, themeColor, themedColor } from '../src/theme/Theme'

const constants = {
  MOODS: [{ id: 'diplomatic', instruction: 'Be balanced.' }],
  DEFAULT_MOOD: 'diplomatic',
  MOOD_INTENSITY: { 2: { instruction: 'balanced' } },
  DEFAULT_MOOD_INTENSITY: 2,
  CHARACTER_TYPES: [],
  RESPONSE_LENGTHS: [],
  EDUCATION_LEVELS: [],
  AGE_GROUPS: [],
  DEFAULT_AGE_GROUP: 2,
  LANGUAGES: [{ code: 'en', label: 'English' }],
  REASONING_LANG_CUSTOM: '__custom__',
}
const actor = { id: 0, tag: 'A', name: 'A', mood: 'diplomatic', moodIntensity: 2, affinity: {}, constraints: [] }

afterEach(() => configureModes([]))

describe('mode configuration', () => {
  it('starts as the shipped list and appends a built-in missing from a saved one', () => {
    expect(getModesConfig().map(entry => entry.id)).toHaveLength(12)
    configureModes([{ id: 'socratic' }, { id: 'free' }])
    expect(DEBATE_MODES.map(mode => mode.id).slice(0, 2)).toEqual(['socratic', 'free'])
    expect(DEBATE_MODES).toHaveLength(12)
  })

  it('drops unknown ids and keeps something selectable', () => {
    configureModes([{ id: 'nonsense' }, { id: 'custom_x1', enabled: false }, ...getModesConfig().map(entry => ({ ...entry, enabled: false }))])
    expect(DEBATE_MODES.some(mode => mode.id === 'nonsense')).toBe(false)
    expect(DEBATE_MODE_OPTIONS.map(option => option.value)).toEqual(['free'])
  })

  it('keeps order and on/off out of the selector without losing the mode', () => {
    let config = toggleModeEntry(getModesConfig(), 'red_team')
    config = moveModeEntry(config, 'socratic', -3)
    configureModes(config)
    const options = DEBATE_MODE_OPTIONS.map(option => option.value)
    expect(options).not.toContain('red_team')
    expect(options.indexOf('socratic')).toBe(6 - 1)
    expect(normalizeDebateMode('red_team')).toBe('red_team')
  })

  it('refuses to switch off the last enabled mode', () => {
    let config = getModesConfig()
    for (const entry of config.slice(1)) config = toggleModeEntry(config, entry.id)
    expect(toggleModeEntry(config, 'free').find(entry => entry.id === 'free').enabled).toBe(true)
  })

  it('stores a built-in rewrite only when it differs from the original', () => {
    configureModes(updateModeEntry(getModesConfig(), 'brainstorm', { instruction: 'Make every turn a pitch.', name: 'Pitch room' }))
    expect(debateModeLabel('brainstorm')).toBe('Pitch room')
    expect(DEBATE_MODES.find(mode => mode.id === 'brainstorm').instruction).toBe('Make every turn a pitch.')
    const original = DEBATE_MODES.find(mode => mode.id === 'brainstorm').instruction
    configureModes(resetModeEntry(getModesConfig(), 'brainstorm'))
    expect(isModeCustomized(getModesConfig().find(entry => entry.id === 'brainstorm'))).toBe(false)
    expect(DEBATE_MODES.find(mode => mode.id === 'brainstorm').instruction).not.toBe(original)
    // Writing the original text back is not an edit.
    configureModes(updateModeEntry(getModesConfig(), 'brainstorm', { instruction: DEBATE_MODES.find(mode => mode.id === 'brainstorm').instruction }))
    expect(getModesConfig().find(entry => entry.id === 'brainstorm').instruction).toBe('')
  })

  it('creates a custom mode whose purpose reaches participants and conclusions', () => {
    const { config, id } = addModeEntry(getModesConfig(), { name: 'Editor desk', instruction: 'Judge every idea as a critical editor.', conclusion: 'List what the editor would cut.' })
    configureModes(config)
    expect(id).toMatch(/^custom_/)
    expect(DEBATE_MODE_CONCLUSION_INSTRUCTIONS[id]).toBe('List what the editor would cut.')
    const prompt = buildSystemPrompt({ actor, allParticipants: [actor], history: [], debateMode: id, constants })
    expect(prompt).toContain('NON-NEGOTIABLE SHARED DEBATE MODE — EDITOR DESK:')
    expect(prompt).toContain('Judge every idea as a critical editor.')
  })

  it('treats a custom mode without a purpose like Free', () => {
    const { config, id } = addModeEntry(getModesConfig(), { name: 'Blank' })
    configureModes(config)
    const prompt = buildSystemPrompt({ actor, allParticipants: [actor], history: [], debateMode: id, constants })
    expect(prompt).toContain('SHARED DEBATE MODE — FREE')
  })

  it('duplicates any mode, with its current text and settings, as a custom one', () => {
    configureModes(updateModeEntry(getModesConfig(), 'decision', { settings: { maxTurns: 2 } }))
    const { config, id } = duplicateModeEntry(getModesConfig(), 'decision', 'Decision, short')
    configureModes(config)
    const copy = DEBATE_MODES.find(mode => mode.id === id)
    const original = DEBATE_MODES.find(mode => mode.id === 'decision')
    expect(copy.custom).toBe(true)
    expect(copy.label).toBe('Decision, short')
    expect(copy.instruction).toBe(original.instruction)
    expect(copy.conclusion).toBe(original.conclusion)
    expect(copy.settings).toEqual({ maxTurns: 2 })
    expect(getModesConfig().findIndex(entry => entry.id === id)).toBe(getModesConfig().findIndex(entry => entry.id === 'decision') + 1)
  })

  it('only deletes the user\'s own modes', () => {
    const { config, id } = addModeEntry(getModesConfig(), { name: 'Temp' })
    expect(removeModeEntry(config, id).some(entry => entry.id === id)).toBe(false)
    expect(removeModeEntry(config, 'free')).toBe(config)
  })
})

describe('mode settings overrides', () => {
  const general = { maxTurns: 6, useSummary: true, dynamicAffinity: true, randomTurnOrder: true, moderationCooling: 0.15, enabledTools: { web_search: true, memory: true }, generalPersonalityInstructions: 'General rules' }

  it('resolves to the general values when a mode replaces nothing', () => {
    const resolved = resolveModeSettings(general, 'free')
    expect(resolved.maxTurns).toBe(6)
    expect(resolved.overridden).toEqual([])
  })

  it('replaces only what the mode sets, tools key by key, and the participant prompt', () => {
    configureModes(updateModeEntry(getModesConfig(), 'socratic', {
      settings: { maxTurns: 3, useSummary: false, enabledTools: { web_search: false } },
      personalityInstructions: 'Socratic rules',
    }))
    const resolved = resolveModeSettings(general, 'socratic')
    expect(resolved).toMatchObject({ maxTurns: 3, useSummary: false, dynamicAffinity: true, generalPersonalityInstructions: 'Socratic rules' })
    expect(resolved.enabledTools).toEqual({ web_search: false, memory: true })
    expect(resolved.overridden).toEqual(expect.arrayContaining(['maxTurns', 'useSummary', 'enabledTools', 'generalPersonalityInstructions']))
  })

  it('discards settings it cannot make sense of', () => {
    configureModes(updateModeEntry(getModesConfig(), 'free', { settings: { maxTurns: 'lots', useSummary: 'yes', moderationCooling: 99, enabledTools: { memory: 'no' } } }))
    expect(getModesConfig().find(entry => entry.id === 'free').settings).toEqual({ moderationCooling: 1 })
  })
})

describe('appearance', () => {
  it('normalizes saved appearance and falls back to the dark defaults', () => {
    expect(normalizeAppearance(undefined)).toEqual({ theme: 'dark', accent: 'indigo', messageFontSize: 14 })
    expect(normalizeAppearance({ theme: 'sepia', accent: 'nope', messageFontSize: 99 })).toEqual({ theme: 'dark', accent: 'indigo', messageFontSize: 22 })
    expect(normalizeAppearance({ theme: 'system', accent: 'green', messageFontSize: 16 })).toEqual({ theme: 'system', accent: 'green', messageFontSize: 16 })
  })

  it('leaves the dark theme\'s stock colours alone and mirrors lightness for the light one', () => {
    expect(themedColor('0f0f0f', { theme: 'dark' })).toBe('#0f0f0f')
    expect(themedColor('0f0f0f', { theme: 'light' })).toBe('#f0f0f0')
    expect(themedColor('000000bb', { theme: 'light' })).toBe('#ffffffbb')
  })

  it('rotates only the accent family', () => {
    expect(themedColor('4ade80', { accent: 'blue' })).toBe('#4ade80')
    expect(themedColor('7c6aff', { accent: 'green' })).not.toBe('#7c6aff')
  })

  it('keeps participant colours out of the accent', () => {
    expect(buildThemeCss({ theme: 'dark', accent: 'green' })).toContain('--p-1c1c2e:#1c1c2e;')
    expect(participantColor('#1c1c2e')).toBe('var(--p-1c1c2e, #1c1c2e)')
    expect(themeColor('#2e2e2e')).toBe('var(--c-2e2e2e, #2e2e2e)')
    expect(themeColor('rebeccapurple')).toBe('rebeccapurple')
  })

  it('does nothing without a document', () => {
    expect(() => applyAppearance({}, { doc: null })).not.toThrow()
  })
})
