import { describe, expect, it } from 'vitest'
import { QUOTE_MESSAGE_TOOL, abbreviateQuote, buildQuote, createConversationToolExecutor, quotableMessageIds } from '../src/tools'
import { buildMessageGroup, describeToolInvocation } from '../src/utils/ChatGrouping'
import { buildMessageReferenceBlock } from '../src/prompts/MessageReference'

const participants = [
  { id: 0, tag: 'A', name: 'Alice', label: '#f00' },
  { id: 1, tag: 'B', name: 'Bob', label: '#0f0' },
]

const messages = [
  { role: 'topic', content: 'Nuclear power', turn: 0, seq: 1 },
  { role: 'A', content: 'Reactors are safe enough when the grid is stable.', turn: 1, seq: 2 },
  { role: 'participant_joined', content: '', turn: 1, seq: 3 },
  { role: 'error', content: 'boom', turn: 1, seq: 4 },
  { role: 'B', content: '', turn: 1, seq: 5 },
]

describe('quote resolution', () => {
  it('quotes a message by its id and returns its full text', () => {
    const result = buildQuote({ messages, participants, messageId: 2 })
    expect(result.accepted).toBe(true)
    expect(result.text).toBe('Reactors are safe enough when the grid is stable.')
    expect(result.quote).toMatchObject({
      messageId: 2,
      authorTag: 'A',
      authorName: 'Alice',
      turn: 1,
      verbatim: false,
    })
  })

  it('keeps a verbatim excerpt and flags one that was invented', () => {
    const exact = buildQuote({ messages, participants, messageId: 2, excerpt: 'safe   enough' })
    expect(exact.quote.verbatim).toBe(true)
    expect(exact.quote.excerpt).toBe('safe enough')
    expect(exact.warning).toBeUndefined()

    const invented = buildQuote({ messages, participants, messageId: 2, excerpt: 'reactors always explode' })
    expect(invented.quote.verbatim).toBe(false)
    expect(invented.quote.excerpt).toBe('Reactors are safe enough when the grid is stable.')
    expect(invented.warning).toMatch(/does not appear/i)
  })

  it('refuses ids that point at nothing quotable, and offers the real ones', () => {
    for (const messageId of [3, 4, 5, 99, 'nope']) {
      const result = buildQuote({ messages, participants, messageId })
      expect(result.accepted, String(messageId)).toBe(false)
      expect(result.availableIds).toEqual([1, 2])
    }
    expect(quotableMessageIds(messages)).toEqual([1, 2])
  })

  it('abbreviates a long message on a word boundary', () => {
    const long = 'word '.repeat(80).trim()
    const short = abbreviateQuote(long, 40)
    expect(short.length).toBeLessThanOrEqual(41)
    expect(short.endsWith('…')).toBe(true)
    expect(short).not.toContain('wor…')
    expect(abbreviateQuote('  short\n text ', 40)).toBe('short text')
  })

  it('reaches the model through the conversation tool executor', async () => {
    const execute = createConversationToolExecutor({
      quote: args => buildQuote({ messages, participants, ...args }),
    })
    const result = JSON.parse(await execute(QUOTE_MESSAGE_TOOL.function.name, { messageId: 2 }))
    expect(result.quote.messageId).toBe(2)

    const unavailable = JSON.parse(await createConversationToolExecutor({})(QUOTE_MESSAGE_TOOL.function.name, { messageId: 2 }))
    expect(unavailable.accepted).toBe(false)
  })
})

describe('quotes on the rendered turn', () => {
  const quote = { messageId: 2, authorTag: 'A', authorName: 'Alice', excerpt: 'safe enough' }

  const group = quotes => {
    const items = [
      { msg: { role: 'B', content: 'First segment', turn: 2, seq: 10 } },
      { msg: { role: 'B', content: 'Second segment', turn: 2, seq: 11, quotes } },
    ]
    return buildMessageGroup({ items, itemIndex: 0, participants })
  }

  it('lifts a citation made in a later segment onto the whole turn, once', () => {
    expect(group([quote, { ...quote }]).quotes).toEqual([quote])
  })

  it('drops the pill of a citation that became a card, and keeps a failed one', () => {
    const items = [{
      msg: {
        role: 'B',
        content: 'Answer',
        turn: 2,
        seq: 10,
        quotes: [quote],
        toolInvocations: [
          { name: 'quote_message', arguments: { messageId: 2 } },
          { name: 'quote_message', arguments: { messageId: 77 } },
        ],
      },
    }]
    const rendered = buildMessageGroup({ items, itemIndex: 0, participants })
    expect(rendered.trailingToolEvents.map(event => event.invocation.arguments.messageId)).toEqual([77])
    expect(describeToolInvocation({ name: 'quote_message', arguments: { messageId: 77 } })).toBe('#77')
  })
})

describe('the message id prompt block', () => {
  it('teaches the tool only when the turn actually carries it', () => {
    expect(buildMessageReferenceBlock({ quoteToolAvailable: true })).toContain('quote_message')
    expect(buildMessageReferenceBlock({ quoteToolAvailable: false })).not.toContain('quote_message')
    expect(buildMessageReferenceBlock()).toContain('[#12]')
  })
})
