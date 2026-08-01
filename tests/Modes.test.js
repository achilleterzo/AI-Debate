import { describe, expect, it } from 'vitest'
import { buildSystemPrompt } from '../src/debate/PromptBuilder'
import { DEFAULT_DEBATE_MODE, DEBATE_MODES, normalizeDebateMode } from '../src/prompts/Modes'

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
  REASONING_LANG_FROM_CONSTRAINT: '__constraint__',
}

const actor = { id: 0, tag: 'A', name: 'A', mood: 'diplomatic', moodIntensity: 2, affinity: {}, constraints: [] }

describe('Debate modes', () => {
  it('offers the complete mode list and defaults invalid values to Free', () => {
    expect(DEBATE_MODES.map(mode => mode.id)).toEqual([
      'free', 'brainstorm', 'fact_check', 'design_review', 'decision',
      'negotiation', 'red_team', 'socratic', 'peer_review', 'consensus',
    ])
    expect(DEFAULT_DEBATE_MODE).toBe('free')
    expect(normalizeDebateMode('missing')).toBe('free')
  })

  it('adds the selected purpose to every participant system prompt', () => {
    const prompt = buildSystemPrompt({
      actor,
      allParticipants: [actor],
      history: [],
      debateMode: 'red_team',
      constants,
    })
    expect(prompt).toContain('NON-NEGOTIABLE SHARED DEBATE MODE — RED TEAM:')
    expect(prompt).toContain('On every turn, attack the strongest current proposal')
    expect(prompt).toContain('this mode outranks mood, personality, affinity')
  })

  it('keeps legacy prompt callers in Free mode', () => {
    const prompt = buildSystemPrompt({ actor, allParticipants: [actor], history: [], constants })
    expect(prompt).toContain('SHARED DEBATE MODE — FREE:')
  })
})
