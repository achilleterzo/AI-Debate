import { describe, expect, it } from 'vitest'
import { topicToSlug } from '../src/utils/Slug'

describe('topicToSlug', () => {
  it('normalizes a topic and removes URLs', () => {
    expect(topicToSlug('  AI Debate: pro & contro! https://example.com/info  ')).toBe('ai-debate-pro-contro')
  })

  it('enforces the requested maximum length without a trailing separator', () => {
    expect(topicToSlug('A title with several words', 12)).toBe('a-title-with')
  })

  it('returns an empty slug for missing or URL-only topics', () => {
    expect(topicToSlug()).toBe('')
    expect(topicToSlug('https://example.com')).toBe('')
  })
})
