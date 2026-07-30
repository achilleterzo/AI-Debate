import { describe, expect, it } from 'vitest'
import { buildSystemPrompt } from '../src/debate/PromptBuilder'

const constants = {
  MOODS: [{ id: 'none', label: 'Neutral' }],
  DEFAULT_MOOD: 'none',
  MOOD_INTENSITY: [{ label: 'Balanced' }],
  DEFAULT_MOOD_INTENSITY: 0,
  CHARACTER_TYPES: [],
  RESPONSE_LENGTHS: [],
  EDUCATION_LEVELS: [],
  AGE_GROUPS: [{}],
  DEFAULT_AGE_GROUP: 0,
  LANGUAGES: [
    { code: 'en', label: 'English' },
    { code: 'it', label: 'Italiano' },
  ],
  REASONING_LANG_FROM_CONSTRAINT: '__constraint__',
}

const participants = [
  { id: 0, tag: 'A', name: 'Alice', mood: 'none', affinity: { 1: 0.6, 2: -0.3 } },
  { id: 1, tag: 'B', name: 'Bob', mood: 'none' },
  { id: 2, tag: 'C', name: 'Carol', mood: 'none' },
]

function build(actorOverrides = {}, extra = {}) {
  return buildSystemPrompt({
    actor: { ...participants[0], ...actorOverrides },
    allParticipants: participants,
    history: [],
    uiLang: 'en',
    constants,
    ...extra,
  })
}

describe('buildSystemPrompt priorities', () => {
  it('includes the actor affinity weights in the prompt', () => {
    const prompt = build()
    expect(prompt).toContain('Your relational affinity toward other participants')
    expect(prompt).toContain('- Bob: +0.60')
    expect(prompt).toContain('- Carol: -0.30')
  })

  it('omits the affinity block when the actor has no non-zero weights', () => {
    const prompt = build({ affinity: {} })
    expect(prompt).not.toContain('Your relational affinity')
  })

  it('orders sections as override > global > personal > baseline conduct', () => {
    const prompt = build(
      {
        constraints: [
          { text: 'Personal rule', override: false },
          { text: 'Override rule', override: true },
        ],
      },
      { globalConstraints: ['Global rule'] },
    )
    const overrideIdx = prompt.indexOf('Character override constraints')
    const globalIdx = prompt.indexOf('Global rules')
    const personalIdx = prompt.indexOf('Your personal constraints')
    const baselineIdx = prompt.indexOf('General debate conduct')

    expect(overrideIdx).toBeGreaterThan(-1)
    expect(globalIdx).toBeGreaterThan(overrideIdx)
    expect(personalIdx).toBeGreaterThan(globalIdx)
    expect(baselineIdx).toBeGreaterThan(personalIdx)

    expect(prompt).toContain('- Override rule')
    expect(prompt).toContain('- Global rule')
    expect(prompt).toContain('- Personal rule')
    expect(prompt).toContain('Precedence between the rule sections')
  })

  it('accepts legacy string constraints as personal constraints', () => {
    const prompt = build({ constraints: ['Legacy string rule'] })
    expect(prompt).toContain('Your personal constraints:\n- Legacy string rule')
    expect(prompt).not.toContain('Character override constraints')
  })

  it('still detects the reasoning language from object-shaped constraints', () => {
    const prompt = build({
      reasoningLang: '__constraint__',
      constraints: [{ text: 'Think in Italiano', override: false }],
    })
    expect(prompt).toContain('Do all internal reasoning and deliberation in Italiano')
  })
})

describe('buildSystemPrompt moderator modes and hierarchy', () => {
  const withModerator = [
    { id: 0, tag: 'A', name: 'Alice', mood: 'none' },
    { id: 1, tag: 'M', name: 'Mod', mood: 'none', isModerator: true, moderatorMode: 'containment' },
  ]

  function buildFor(actor, extra = {}) {
    return buildSystemPrompt({
      actor,
      allParticipants: withModerator,
      history: [],
      uiLang: 'en',
      constants,
      ...extra,
    })
  }

  it('tells participants to respect the moderator hierarchy when a moderator exists', () => {
    const prompt = buildFor(withModerator[0])
    expect(prompt).toContain('A moderator holds procedural authority over this debate')
  })

  it('omits the hierarchy rule when there is no moderator', () => {
    const prompt = build()
    expect(prompt).not.toContain('A moderator holds procedural authority')
  })

  it('renders containment style with SKIP_TURN fallback', () => {
    const prompt = buildFor(withModerator[1])
    expect(prompt).toContain('style=containment')
    expect(prompt).toContain('Moderation style: CONTAINMENT')
    expect(prompt).toContain('[SKIP_TURN]')
  })

  it('renders the scheduled facilitation analysis instructions', () => {
    const actor = { ...withModerator[1], moderatorMode: 'facilitator' }
    const prompt = buildFor(actor, { externalModerationTrigger: { needed: false, reason: '', scheduledFacilitation: true } })
    expect(prompt).toContain('Moderation style: FACILITATOR')
    expect(prompt).toContain('scheduled facilitation turn')
    expect(prompt).toContain('blind spots')
    expect(prompt).not.toContain('output only moderation or process control')
  })

  it('renders the active style without the process-only restriction', () => {
    const actor = { ...withModerator[1], moderatorMode: 'active' }
    const prompt = buildFor(actor, { externalModerationTrigger: { needed: false, reason: '', scheduledFacilitation: false } })
    expect(prompt).toContain('Moderation style: ACTIVE')
    expect(prompt).not.toContain('output only moderation or process control')
  })
})
