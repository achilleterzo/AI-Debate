import { describe, expect, it } from 'vitest'
import { formatHistoryMessage, formatQuoteAnnotation, idMarker } from '../src/debate/ContextPayload'

const participants = [
  { id: 0, tag: 'A', name: 'Alice' },
  { id: 1, tag: 'B', name: 'Bob' },
  { id: 2, tag: 'M', name: 'Mia', isModerator: true },
]

const actor = participants[1]
const format = message => formatHistoryMessage({ message, actor, participants })

describe('message ids in the payload', () => {
  it('announces every message the actor did not write', () => {
    expect(format({ role: 'topic', content: 'Nuclear power', seq: 1 }).content)
      .toBe('[#1] [Topic]: Nuclear power')
    expect(format({ role: 'interjection', content: 'Consider costs', seq: 2 }).content)
      .toBe('[#2] [Topic update]: Consider costs')
    expect(format({ role: 'user', content: 'Stay concrete', seq: 3 }).content)
      .toBe('[#3] [Moderator]: Stay concrete')
    expect(format({ role: 'A', content: 'Reactors are safe.', seq: 4 }).content)
      .toBe('[#4] Alice said: Reactors are safe.')
    expect(format({ role: 'dice', content: '(1d20) -> 17', seq: 5 }).content)
      .toMatch(/^\[#5\] \[DICE RESULT/)
  })

  it('leaves the actor its own turns bare, so it never learns to write markers', () => {
    expect(format({ role: 'B', content: 'My own turn', seq: 6 }))
      .toEqual({ role: 'assistant', content: 'My own turn' })
  })

  it('says nothing when the timeline never numbered the message', () => {
    expect(idMarker({ role: 'A', content: 'x' })).toBe('')
    expect(format({ role: 'A', content: 'Legacy message' }).content).toBe('Alice said: Legacy message')
  })

  it('still drops what carries no contribution at all', () => {
    expect(format({ role: 'A', content: '   ', seq: 7 })).toBeNull()
    expect(format({ role: 'A', content: '<function_calls>…', seq: 8 })).toBeNull()
    expect(format({ role: 'participant_joined', content: '', seq: 9 })).toBeNull()
  })
})

describe('citations in the payload', () => {
  const quote = { messageId: 4, authorTag: 'A', authorName: 'Alice', excerpt: 'Reactors are safe.' }

  it('carries the cited id and its excerpt, so the reader needs no extra tool call', () => {
    expect(format({ role: 'M', content: 'Answer that point.', seq: 10, quotes: [quote] }).content)
      .toContain('Mia (citing [#4] Alice: "Reactors are safe."): Answer that point.')
    expect(format({ role: 'A', content: 'I disagree.', seq: 11, quotes: [quote] }).content)
      .toBe('[#11] Alice said (citing [#4] Alice: "Reactors are safe."): I disagree.')
  })

  it('tells the reader when the citation points at the reader', () => {
    expect(formatQuoteAnnotation([{ ...quote, authorTag: 'B', authorName: 'Bob' }], 'B'))
      .toBe(' (citing [#4] you: "Reactors are safe.")')
  })

  it('lists several citations and ignores broken ones', () => {
    expect(formatQuoteAnnotation([quote, { messageId: 7, authorTag: 'M', excerpt: 'Stop there' }, { excerpt: 'orphan' }]))
      .toBe(' (citing [#4] Alice: "Reactors are safe." ; [#7] M: "Stop there")')
    expect(formatQuoteAnnotation([])).toBe('')
    expect(formatQuoteAnnotation()).toBe('')
  })
})
