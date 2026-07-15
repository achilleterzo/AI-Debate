import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MODERATION_COOLING,
  MAX_MODERATION_COOLING,
  MIN_MODERATION_COOLING,
  normalizeModerationCooling,
} from '../src/settings/Settings'

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
