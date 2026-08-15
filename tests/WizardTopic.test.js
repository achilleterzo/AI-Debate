import { describe, expect, it } from 'vitest'
import { MAX_TOPIC_CHARS, buildTopicProposalPrompt, parseTopicProposal } from '../src/services/Suggestions'

describe('the topic the wizard proposes', () => {
  it('is written from the purpose the wizard already collected', () => {
    const prompt = buildTopicProposalPrompt({
      debateMode: 'decision',
      debateModeLabel: 'Decision',
      debateModeInstruction: 'Move the group toward a decision.',
      purpose: 'decide whether to rewrite the payments service',
      participants: [
        { name: 'Ada', traits: ['You argue from operational cost.'], isModerator: true },
        { name: 'Bo', traits: ['You defend incremental change.'] },
      ],
      languageNamed: 'Italiano (language code: it)',
    })

    expect(prompt).toContain('decide whether to rewrite the payments service')
    expect(prompt).toContain('Decision (decision)')
    expect(prompt).toContain('Ada (moderator)')
    expect(prompt).toContain('You defend incremental change.')
    expect(prompt).toContain('Italiano')
    expect(prompt).toContain('do not answer the topic yourself')
  })

  it('falls back to the mode when no purpose was given', () => {
    const prompt = buildTopicProposalPrompt({ debateMode: 'brainstorm', purpose: '' })

    expect(prompt).toContain('has not described a purpose')
  })

  it('asks Role Play for an opening scene rather than a question', () => {
    const prompt = buildTopicProposalPrompt({ debateMode: 'role_play', purpose: 'a heist' })

    expect(prompt).toContain('opening scene')
    expect(prompt).not.toContain('do not assign positions')
  })
})

describe('reading the proposed topic back', () => {
  it('takes the string out of the requested JSON array', () => {
    expect(parseTopicProposal('["Decide whether to rewrite the payments service."]'))
      .toBe('Decide whether to rewrite the payments service.')
  })

  it('accepts a fenced array, which is what models send half the time', () => {
    expect(parseTopicProposal('```json\n["Weigh cost against risk."]\n```')).toBe('Weigh cost against risk.')
  })

  it('keeps every paragraph when the answer comes back as prose', () => {
    // The list parser would have kept only the first line.
    const answer = 'The table must decide whether to rewrite.\n\nWeigh cost, risk and delivery time.'
    expect(parseTopicProposal(answer)).toBe('The table must decide whether to rewrite.\nWeigh cost, risk and delivery time.')
  })

  it('caps a topic that ignores the length it was given', () => {
    expect(parseTopicProposal('x'.repeat(5_000)).length).toBe(MAX_TOPIC_CHARS)
  })

  it('reads an empty or unusable answer as no proposal', () => {
    expect(parseTopicProposal('')).toBe('')
    expect(parseTopicProposal(null)).toBe('')
  })
})
