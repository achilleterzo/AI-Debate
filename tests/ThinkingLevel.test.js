import { describe, expect, it } from 'vitest'
import { Debate } from '../src/debate/Debate'

describe('the reasoning level a participant follows', () => {
  it('takes the general default when the participant picked none', () => {
    expect(Debate.resolveThinkingLevel({ thinkingLevel: '' }, 'high')).toBe('high')
    expect(Debate.resolveThinkingLevel({}, 'medium')).toBe('medium')
  })

  it('keeps the participant choice, including turning reasoning off', () => {
    expect(Debate.resolveThinkingLevel({ thinkingLevel: 'low' }, 'high')).toBe('low')
    expect(Debate.resolveThinkingLevel({ thinkingLevel: 'none' }, 'high')).toBe('none')
  })

  // A level nobody recognises must not become "follow the default": that would
  // make a typo in a stored session behave like a deliberate choice.
  it('falls back to the built-in default for an unrecognised level', () => {
    expect(Debate.resolveThinkingLevel({ thinkingLevel: 'turbo' }, 'high')).toBe(Debate.DEFAULT_THINKING_LEVEL)
    expect(Debate.resolveThinkingLevel({ thinkingLevel: '' }, 'turbo')).toBe(Debate.DEFAULT_THINKING_LEVEL)
  })

  it('is stored as the choice, not as the level it currently resolves to', () => {
    expect(Debate.normalizeThinkingLevelChoice('')).toBe(Debate.INHERIT_THINKING_LEVEL)
    expect(Debate.normalizeThinkingLevelChoice('max')).toBe('max')
    expect(Debate.normalizeThinkingLevelChoice('turbo')).toBe(Debate.DEFAULT_THINKING_LEVEL)
  })

  it('starts a new participant on the default, like the model does', () => {
    expect(Debate.mkParticipant(0).thinkingLevel).toBe(Debate.INHERIT_THINKING_LEVEL)
    expect(Debate.mkParticipant(0).model).toBe('')
  })
})

describe('Debate.withRunDefaults', () => {
  it('fills in both fallbacks for a participant that chose neither', () => {
    const actor = Debate.withRunDefaults(Debate.mkParticipant(0), { defaultModel: 'llama', defaultThinkingLevel: 'high' })
    expect(actor).toMatchObject({ model: 'llama', thinkingLevel: 'high' })
  })

  it('leaves what the participant did choose alone', () => {
    const participant = { ...Debate.mkParticipant(0, 'mistral'), thinkingLevel: 'none' }
    const actor = Debate.withRunDefaults(participant, { defaultModel: 'llama', defaultThinkingLevel: 'high' })
    expect(actor).toMatchObject({ model: 'mistral', thinkingLevel: 'none' })
  })

  it('runs at the built-in default when no general default is configured', () => {
    expect(Debate.withRunDefaults(Debate.mkParticipant(0)).thinkingLevel).toBe(Debate.DEFAULT_THINKING_LEVEL)
  })
})

describe('a participant through a saved session', () => {
  it('comes back following the default when the record predates the setting', () => {
    const [hydrated] = Debate.hydrateParticipantsFromSession([{ id: 0, model: 'llama', mood: 'diplomatic' }])
    expect(hydrated.thinkingLevel).toBe(Debate.INHERIT_THINKING_LEVEL)
  })

  // The level chosen before the general default existed is a real choice and
  // stays one; it does not silently start following the new setting.
  it('keeps an explicitly stored level', () => {
    const [hydrated] = Debate.hydrateParticipantsFromSession([{ id: 0, model: 'llama', mood: 'diplomatic', thinkingLevel: 'medium' }])
    expect(hydrated.thinkingLevel).toBe('medium')

    const [serialized] = Debate.serializeParticipantsForSession([hydrated])
    expect(serialized.thinkingLevel).toBe('medium')
  })
})

describe('reasoning defaults per provider', () => {
  const providerThinkingLevels = { ollama: 'none', claude: 'high', openai: 'medium' }

  it('gives an inheriting participant the default of its own provider', () => {
    const onClaude = { ...Debate.mkParticipant(0), providerId: 'claude', model: 'sonnet' }
    const actor = Debate.withRunDefaults(onClaude, { defaultProviderId: 'ollama', defaultThinkingLevel: 'none', providerThinkingLevels })
    expect(actor.thinkingLevel).toBe('high')
  })

  it('uses the default provider for a participant without one', () => {
    const actor = Debate.withRunDefaults(Debate.mkParticipant(0), { defaultProviderId: 'openai', defaultModel: 'gpt-test', providerThinkingLevels })
    expect(actor).toMatchObject({ providerId: 'openai', model: 'gpt-test', thinkingLevel: 'medium' })
  })

  it('still lets the participant choice win', () => {
    const participant = { ...Debate.mkParticipant(0), providerId: 'claude', model: 'sonnet', thinkingLevel: 'low' }
    expect(Debate.withRunDefaults(participant, { providerThinkingLevels }).thinkingLevel).toBe('low')
  })
})
