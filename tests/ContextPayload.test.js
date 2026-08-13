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

// A transcript recorded before the stream stripped them still carries the
// block, and this function is what every participant reads.
describe('leaked reasoning in the payload', () => {
  it('never ships one participant deliberation to the others', () => {
    expect(format({ role: 'A', content: '<reasoning>Я думаю по-русски.</reasoning>Reactors are safe.', seq: 12 }).content)
      .toBe('[#12] Alice said: Reactors are safe.')
  })

  it('keeps the actor own deliberation out of its own turns too', () => {
    expect(format({ role: 'B', content: '<think>hidden</think>My own turn', seq: 13 }))
      .toEqual({ role: 'assistant', content: 'My own turn' })
  })

  it('treats a turn that was nothing but deliberation as no contribution', () => {
    expect(format({ role: 'A', content: '<reasoning>only thinking</reasoning>', seq: 14 })).toBeNull()
  })

  // A block the model never closed would otherwise take the whole message with
  // it, and the turn would vanish from the payload while staying in the chat.
  it('still carries a turn whose block was never closed', () => {
    expect(format({ role: 'A', content: '<think>deliberating\n\nHere is the contribution.', seq: 15 }).content)
      .toBe('[#15] Alice said: deliberating\n\nHere is the contribution.')
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

// A model writes the call into the prose instead of emitting it. The call never
// ran, and a transcript that keeps it hands the syntax to everyone who reads
// the turn: the next participant copies it, and within a round the whole table
// is typing calls nobody executes. Cleaning on the way in is what breaks that
// chain, including for the turns already recorded — they are cleaned again
// every time they are sent.
describe('typed tool calls in the payload', () => {
  it('removes the compact inline form, keeping the prose around it', () => {
    const content = 'All this talking is tiring.\n\n<call:roll_dice{count:1,sides:20}/>\n\nI throw an ordinary punch.'
    expect(format({ role: 'A', content, seq: 20 }).content)
      .toBe('[#20] Alice said: All this talking is tiring.\n\nI throw an ordinary punch.')
  })

  it('removes a citation call written with the quoting some models use inside it', () => {
    const content = '<call:quote_message{excerpt:<|"|>a trembling hand<|"|>,messageId:544}/>\n\nThat is exactly the point.'
    expect(format({ role: 'A', content, seq: 21 }).content)
      .toBe('[#21] Alice said: That is exactly the point.')
  })

  it('treats a turn that was nothing but a typed call as no contribution', () => {
    expect(format({ role: 'A', content: '<call:roll_dice{count:1,sides:20}/>', seq: 22 })).toBeNull()
  })

  it('removes the tool name written as a tag, and the arguments written alone', () => {
    expect(format({ role: 'A', content: '**Attacking Madara**: <roll_dice count="1" sides="20"/> I throw a punch.', seq: 23 }).content)
      .toBe('[#23] Alice said: **Attacking Madara**:  I throw a punch.')
    expect(format({ role: 'M', content: 'Resolving.\n\n<quote_message messageId="50" />\n\nA total failure.', seq: 24 }).content)
      .toContain('Resolving.\n\nA total failure.')
  })

  it('does not come back to the actor in its own turns either', () => {
    expect(format({ role: 'B', content: 'I strike.\n\n{ "count": 1, "sides": 20 }', seq: 25 }))
      .toEqual({ role: 'assistant', content: 'I strike.' })
  })
})
