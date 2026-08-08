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
  REASONING_LANG_CUSTOM: '__custom__',
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

  it('keeps conversation transcript out of the system prompt', () => {
    const prompt = build({}, {
      history: [{ role: 'B', content: 'This belongs in the chat context.' }],
    })

    expect(prompt).not.toContain('Recent conversation:')
    expect(prompt).not.toContain('This belongs in the chat context.')
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

  it('names a custom thinking language exactly as typed, without a language code', () => {
    const prompt = build({ reasoningLang: '__custom__', reasoningLangCustom: 'Napoletano' })
    expect(prompt).toContain('Do all internal reasoning and deliberation in Napoletano.')
    expect(prompt).not.toContain('language code: Napoletano')
  })

  it('keeps the custom language in the visible answer when translation is skipped', () => {
    const prompt = build({
      reasoningLang: '__custom__',
      reasoningLangCustom: 'Latino',
      reasoningLangSkipTranslation: true,
    })
    expect(prompt).toContain('write your final visible response in Latino as well')
  })

  it('falls back to the output language when the custom entry is blank', () => {
    const prompt = build({ reasoningLang: '__custom__', reasoningLangCustom: '   ' })
    expect(prompt).toContain('Respond in English (language code: en).')
    expect(prompt).not.toContain('internal reasoning')
  })

  it('still resolves a language picked from the fixed list', () => {
    const prompt = build({ reasoningLang: 'it' })
    expect(prompt).toContain('Do all internal reasoning and deliberation in Italiano (language code: it)')
  })

  it('names a custom output language as typed, without inventing a code for it', () => {
    const prompt = build({}, { uiLang: 'Napoletano' })
    expect(prompt).toContain('Respond in Napoletano.')
    expect(prompt).not.toContain('language code: Napoletano')
  })

  it('keeps translating into a custom output language when the thinking language differs', () => {
    const prompt = build({ reasoningLang: 'it' }, { uiLang: 'Napoletano' })
    expect(prompt).toContain('written only in Napoletano')
    expect(prompt).not.toContain('language code: Napoletano')
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
    expect(prompt).toContain('Treat a moderator intervention as a binding procedural instruction')
    expect(prompt).toContain('If the moderator explicitly instructs you to use a tool')
    expect(prompt).toContain('current request payload and its tools array are the source of truth')
    expect(prompt).toContain('never write a tool name, pseudo-call, Markdown code')
    expect(prompt).toContain('A tool instruction and a tool invocation are different events')
    expect(prompt).toContain('NON-NEGOTIABLE STRUCTURED TOOL-CALL PROTOCOL')
    expect(prompt).toContain('The tool result is then returned in the conversation as a tool message')
    expect(prompt).toContain('continue with a complete assistant response after the tool result')
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

  it('separates binding procedural authority from contestable substantive claims outside containment', () => {
    const prompt = buildFor(withModerator[0], {})
    expect(prompt).not.toContain("The moderator's procedural decisions are binding")

    const facilitatorPrompt = buildFor(withModerator[0], {
      // The shared roster is intentionally immutable in this helper; use an
      // active moderator actor to verify the rule is present for all prompts.
      allParticipants: [withModerator[0], { ...withModerator[1], moderatorMode: 'facilitator' }],
    })
    expect(facilitatorPrompt).toContain("The moderator's procedural decisions are binding. Their substantive claims are arguments like those of any other participant and may be challenged.")
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

  it('prioritizes reactive moderation over scheduled facilitation', () => {
    const actor = { ...withModerator[1], moderatorMode: 'facilitator' }
    const prompt = buildFor(actor, {
      externalModerationTrigger: {
        needed: true,
        reason: 'personal attack detected',
        scheduledFacilitation: true,
        reactiveModeration: true,
      },
    })
    expect(prompt).toContain('moderate it now, regardless of the facilitation schedule')
    expect(prompt).not.toContain('This turn is a scheduled facilitation turn')
    expect(prompt).toContain('output only moderation or process control')
  })

  it('requires the active style to address a reactive attack', () => {
    const actor = { ...withModerator[1], moderatorMode: 'active' }
    const prompt = buildFor(actor, {
      externalModerationTrigger: { needed: true, reason: 'attack', reactiveModeration: true },
    })
    expect(prompt).toContain('address the attack or escalating hostility first')
  })

  it('places the latest moderator intervention in a binding system-level block', () => {
    const moderator = { id: 1, tag: 'M', name: 'Moderator', mood: 'none', isModerator: true, moderatorMode: 'containment' }
    const prompt = buildSystemPrompt({
      actor: participants[0],
      allParticipants: [participants[0], moderator],
      history: [{ role: 'M', content: 'Stop the personal attacks and answer the question.' }],
      uiLang: 'en',
      constants,
    })
    expect(prompt).toContain('Latest moderator intervention (binding procedural instruction)')
    expect(prompt).toContain('Stop the personal attacks and answer the question.')
    expect(prompt).toContain('do not treat it as a debatable participant position')
  })
})

describe('reasoning instructions follow the thinking level', () => {
  it('omits the reasoning focus when the participant thinks instantly', () => {
    const prompt = build({ thinkingLevel: 'none' })
    expect(prompt).not.toContain('<reasoning_focus>')
    expect(prompt).not.toContain('NON-NEGOTIABLE REASONING FOCUS')
    expect(prompt).not.toContain('Before producing the answer, deliberate')
  })

  it('omits it just the same when no level is set at all', () => {
    expect(build()).not.toContain('<reasoning_focus>')
    expect(build({ thinkingLevel: 'whatever' })).not.toContain('<reasoning_focus>')
  })

  it('sends it to a participant whose native reasoning is on', () => {
    for (const level of ['low', 'medium', 'high', 'max']) {
      const prompt = build({ thinkingLevel: level })
      expect(prompt, level).toContain('<reasoning_focus>')
      expect(prompt, level).toContain('Do not spend reasoning time listing')
    }
  })

  it('keeps the context rules in both cases: they do not depend on thinking', () => {
    for (const level of ['none', 'high']) {
      const prompt = build({ thinkingLevel: level })
      expect(prompt, level).toContain('<context_discipline>')
      expect(prompt, level).toContain('Do not merge reference material into the rules')
      expect(prompt, level).toContain('Do not invent omitted history')
    }
  })
})

describe('the tool protocol follows what the request actually carries', () => {
  it('demands structured calls when tools are on the way', () => {
    const prompt = build({}, { toolsAvailable: true })
    expect(prompt).toContain('NON-NEGOTIABLE STRUCTURED TOOL-CALL PROTOCOL')
    expect(prompt).not.toContain('NO TOOLS ARE AVAILABLE IN THIS TURN')
  })

  it('says so plainly when no tools are sent, instead of describing an interface that is absent', () => {
    const prompt = build({}, { toolsAvailable: false })
    expect(prompt).toContain('NO TOOLS ARE AVAILABLE IN THIS TURN')
    expect(prompt).not.toContain('NON-NEGOTIABLE STRUCTURED TOOL-CALL PROTOCOL')
    expect(prompt).not.toContain('structured tool_calls event')
  })

  it('asks a toolless moderator to write the intervention rather than call for it', () => {
    const trigger = { needed: true, reason: 'hostility' }
    const withTools = build({ isModerator: true }, { externalModerationTrigger: trigger, toolsAvailable: true })
    const withoutTools = build({ isModerator: true }, { externalModerationTrigger: trigger, toolsAvailable: false })

    expect(withTools).toContain('apply_moderation tool call')
    expect(withoutTools).not.toContain('apply_moderation')
    expect(withoutTools).toContain('write it directly as your visible response')
  })
})
