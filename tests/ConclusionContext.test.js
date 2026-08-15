import { describe, expect, it } from 'vitest'
import { Debate } from '../src/debate/Debate'
import { CONCLUSION_TYPES } from '../src/prompts/ConclusionTypes'

const participants = [
  { tag: 'p1', name: 'Ann' },
  { tag: 'p2', name: 'Bo' },
]
const turn = (tag, size, filler = 'x') => ({ role: tag, content: filler.repeat(size) })

describe('buildConclusionConversation', () => {
  it('sends a long turn whole instead of cutting every message to a fixed size', () => {
    // The regression: every message arrived clipped at 600 characters, so no
    // argument was ever present end to end and the reviewer read half-sentences.
    const long = turn('p1', 5_000)
    const conversation = Debate.buildConclusionConversation([long], participants, { limit: 100_000 })

    expect(conversation).toBe(`Ann: ${long.content}`)
    expect(conversation).not.toContain('truncated')
  })

  it('drops the oldest whole messages when the budget runs out, and says how many', () => {
    const history = [turn('p1', 1_000, 'a'), turn('p2', 1_000, 'b'), turn('p1', 1_000, 'c')]
    const conversation = Debate.buildConclusionConversation(history, participants, { limit: 2_200 })

    expect(conversation).toContain('…[1 earlier messages omitted for context]')
    expect(conversation).not.toContain('a'.repeat(10))
    // Both survivors are intact: kept messages are never clipped.
    expect(conversation).toContain(`Bo: ${history[1].content}`)
    expect(conversation).toContain(`Ann: ${history[2].content}`)
  })

  it('keeps the newest message whole even when it alone exceeds the budget', () => {
    // Same rule capContextMessages follows: the transport guard bounds the
    // payload, and dropping it would send a conclusion with no conversation.
    const newest = turn('p2', 9_000)
    const conversation = Debate.buildConclusionConversation([turn('p1', 500, 'a'), newest], participants, { limit: 2_000 })

    expect(conversation).toContain(newest.content)
  })

  it('applies a per-message cap only when a caller asks for one', () => {
    const conversation = Debate.buildConclusionConversation([turn('p1', 1_000)], participants, { limit: 100_000, messageLimit: 100 })

    expect(conversation).toContain('…[message truncated]')
    expect(conversation.length).toBeLessThan(200)
  })
})

describe('buildConclusionRequest', () => {
  const request = (history, contextChars, extra = {}) => Debate.buildConclusionRequest({
    history,
    participants,
    conclusionType: CONCLUSION_TYPES.find(type => type.id === 'considerations'),
    type: 'considerations',
    model: 'test-model',
    contextChars,
    ...extra,
  })

  it('fits the assembled prompt inside the context budget', () => {
    // Measured on the prompt, not on the transcript: the conversation travels
    // inside JSON, where every newline costs two characters.
    const history = Array.from({ length: 40 }, (_, index) => turn(index % 2 ? 'p2' : 'p1', 2_000))
    const { prompt } = request(history, 32_768)

    expect(prompt.length).toBeLessThanOrEqual(32_768)
    expect(prompt).toContain('earlier messages omitted for context')
  })

  it('spends the larger setting on the transcript instead of a fixed ceiling', () => {
    const history = Array.from({ length: 40 }, (_, index) => turn(index % 2 ? 'p2' : 'p1', 2_000))
    const small = request(history, 16_384).conversation.length
    const large = request(history, 131_072).conversation.length

    expect(large).toBeGreaterThan(small * 2)
  })

  it('leaves room for the attachments the same payload carries', () => {
    const history = Array.from({ length: 20 }, () => turn('p1', 2_000))
    const attachedDocs = [{ name: 'brief.md', content: 'd'.repeat(8_000) }]
    const { prompt } = request(history, 16_384, { attachedDocs })

    expect(prompt.length).toBeLessThanOrEqual(16_384)
    expect(prompt).toContain('brief.md')
  })

  it('sends the whole debate when the budget covers it', () => {
    const history = [turn('p1', 400, 'a'), turn('p2', 400, 'b')]
    const { conversation } = request(history, 131_072)

    expect(conversation).toBe(`Ann: ${history[0].content}\n\nBo: ${history[1].content}`)
  })
})
