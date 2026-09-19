import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DEBUG_PAYLOAD_TURNS,
  MAX_DEBUG_PAYLOAD_TURNS,
  normalizeDebugPayloadTurns,
  DEFAULT_MODERATION_COOLING,
  MAX_MODERATION_COOLING,
  MIN_MODERATION_COOLING,
  DEFAULT_MODERATOR_PERMISSIVENESS,
  normalizeModerationCooling,
  normalizeModeratorPermissiveness,
  normalizeDisabledModels,
  normalizeProviderModelSettings,
  normalizeProviderModelCache,
  providerThinkingLevels,
  DEFAULT_SEARCH_ENGINE,
  normalizeSearchEngine,
} from '../src/settings/Settings'

describe('normalizeDisabledModels', () => {
  it('keeps trimmed, unique names and drops everything else', () => {
    expect(normalizeDisabledModels(['a:latest', ' b:latest ', 'a:latest', '', null, 3]))
      .toEqual(['a:latest', 'b:latest', '3'])
  })

  it('falls back to an empty list for anything that is not an array', () => {
    expect(normalizeDisabledModels()).toEqual([])
    expect(normalizeDisabledModels(null)).toEqual([])
    expect(normalizeDisabledModels('a:latest')).toEqual([])
  })
})

describe('search engine setting', () => {
  it('accepts supported engines and sends invalid values back to Auto', () => {
    expect(normalizeSearchEngine('brave')).toBe('brave')
    expect(normalizeSearchEngine('google')).toBe('google')
    expect(normalizeSearchEngine('unknown')).toBe(DEFAULT_SEARCH_ENGINE)
    expect(normalizeSearchEngine()).toBe(DEFAULT_SEARCH_ENGINE)
  })
})

describe('normalizeProviderModelSettings', () => {
  it('keeps separate defaults and disabled models for every supported provider', () => {
    expect(normalizeProviderModelSettings({
      ollama: { defaultModel: ' llama3 ', disabledModels: ['old', 'old'] },
      openai: { defaultModel: 'gpt-5', disabledModels: ['mini'] },
      unsupported: { defaultModel: 'ignored', disabledModels: [] },
    })).toEqual({
      ollama: { defaultModel: 'llama3', disabledModels: ['old'] },
      openai: { defaultModel: 'gpt-5', disabledModels: ['mini'] },
    })
  })

  it('rejects malformed provider settings', () => {
    expect(normalizeProviderModelSettings(null)).toEqual({})
    expect(normalizeProviderModelSettings([])).toEqual({})
  })
})

describe('normalizeModerationCooling', () => {
  it('uses the default for invalid or non-positive values', () => {
    expect(normalizeModerationCooling()).toBe(DEFAULT_MODERATION_COOLING)
    expect(normalizeModerationCooling('invalid')).toBe(DEFAULT_MODERATION_COOLING)
    expect(normalizeModerationCooling(0)).toBe(DEFAULT_MODERATION_COOLING)
  })

  it('clamps valid values to the supported range', () => {
    expect(normalizeModerationCooling(-1)).toBe(DEFAULT_MODERATION_COOLING)
    expect(normalizeModerationCooling(0.5)).toBe(0.5)
    expect(normalizeModerationCooling(100)).toBe(MAX_MODERATION_COOLING)
    expect(normalizeModerationCooling(0.001)).toBe(MIN_MODERATION_COOLING)
  })
})

describe('normalizeModeratorPermissiveness', () => {
  it('defaults invalid values and clamps the five levels', () => {
    expect(normalizeModeratorPermissiveness()).toBe(DEFAULT_MODERATOR_PERMISSIVENESS)
    expect(normalizeModeratorPermissiveness(-1)).toBe(0)
    expect(normalizeModeratorPermissiveness(2.6)).toBe(3)
    expect(normalizeModeratorPermissiveness(99)).toBe(4)
  })
})

describe('debug payload retention', () => {
  it('clamps to a usable range and falls back to the default', () => {
    expect(normalizeDebugPayloadTurns(12)).toBe(12)
    expect(normalizeDebugPayloadTurns('3')).toBe(3)
    expect(normalizeDebugPayloadTurns(2.6)).toBe(3)
    expect(normalizeDebugPayloadTurns(0)).toBe(DEFAULT_DEBUG_PAYLOAD_TURNS)
    expect(normalizeDebugPayloadTurns(-4)).toBe(DEFAULT_DEBUG_PAYLOAD_TURNS)
    expect(normalizeDebugPayloadTurns('nonsense')).toBe(DEFAULT_DEBUG_PAYLOAD_TURNS)
    expect(normalizeDebugPayloadTurns(undefined)).toBe(DEFAULT_DEBUG_PAYLOAD_TURNS)
    expect(normalizeDebugPayloadTurns(9999)).toBe(MAX_DEBUG_PAYLOAD_TURNS)
  })
})

describe('per-provider reasoning defaults', () => {
  it('keeps a valid level per provider and drops an invalid one', () => {
    const normalized = normalizeProviderModelSettings({
      openai: { defaultModel: 'gpt-test', disabledModels: [], defaultThinkingLevel: 'high' },
      claude: { defaultModel: 'sonnet', disabledModels: [], defaultThinkingLevel: 'extreme' },
    })
    expect(normalized.openai.defaultThinkingLevel).toBe('high')
    expect(normalized.claude).not.toHaveProperty('defaultThinkingLevel')
  })

  it('fills providers without a level from the fallback', () => {
    const levels = providerThinkingLevels({ openai: { defaultThinkingLevel: 'max' } }, 'low')
    expect(levels).toMatchObject({ openai: 'max', claude: 'low', ollama: 'low', 'ollama-cloud': 'low' })
  })
})

describe('normalizeProviderModelCache', () => {
  it('keeps known providers with clean, unique model names', () => {
    expect(normalizeProviderModelCache({ openai: ['gpt-a', ' gpt-a ', '', 'gpt-b'], nope: ['x'], claude: 'sonnet' }))
      .toEqual({ openai: ['gpt-a', 'gpt-b'] })
    expect(normalizeProviderModelCache(null)).toEqual({})
  })
})
