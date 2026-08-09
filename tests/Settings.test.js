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
