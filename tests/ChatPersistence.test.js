import { afterEach, describe, expect, it, vi } from 'vitest'
import { Storage } from '../src/data/Storage'

// The tests run in the node environment, so localStorage is stubbed per case.
function stubLocalStorage(initial = {}, { quotaAfterBytes = Infinity } = {}) {
  const store = { ...initial }
  globalThis.localStorage = {
    getItem: key => (key in store ? store[key] : null),
    setItem: (key, value) => {
      const text = String(value)
      if (text.length > quotaAfterBytes) throw new Error('QuotaExceededError')
      store[key] = text
    },
    removeItem: key => { delete store[key] },
  }
  return store
}

const chat = {
  messages: [
    { role: 'topic', seq: 1, content: 'The topic' },
    { role: 'A', seq: 2, turn: 1, content: 'First argument' },
  ],
  summary: 'What was said so far',
  conclusions: [{ seq: 3, type: 'summary', content: 'A conclusion' }],
  memory: [{ author: 'A', content: 'remembered' }],
  turn: { round: 2, step: 1 },
  seq: 3,
  roundLimit: 6,
}

afterEach(() => {
  delete globalThis.localStorage
  vi.restoreAllMocks()
})

describe('the chat that survives a reload', () => {
  it('comes back with the counters, not only the transcript', () => {
    stubLocalStorage()
    Storage.saveChat(chat)

    expect(Storage.loadChat()).toMatchObject({
      messages: chat.messages,
      summary: chat.summary,
      conclusions: chat.conclusions,
      memory: chat.memory,
      turn: { round: 2, step: 1 },
      seq: 3,
      roundLimit: 6,
    })
  })

  // Debug payloads are the largest thing a message carries and they belong to
  // the run that produced them.
  it('stores the transcript without the debug payloads', () => {
    const store = stubLocalStorage()
    Storage.saveChat({
      ...chat,
      messages: [{ role: 'A', seq: 2, content: 'Argument', payload: { huge: 'x'.repeat(1000) }, debugPayloads: [1, 2, 3] }],
    })

    const stored = JSON.parse(store[Storage.LS_CHAT_KEY]).messages[0]
    expect(stored).toEqual({ role: 'A', seq: 2, content: 'Argument' })
  })

  it('keeps the most recent messages when the transcript does not fit', () => {
    const many = Array.from({ length: 400 }, (_, index) => ({ role: 'A', seq: index + 1, content: `Message ${index + 1}` }))
    const store = stubLocalStorage({}, { quotaAfterBytes: 12000 })
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(Storage.saveChat({ ...chat, messages: many })).toBe(true)
    const stored = JSON.parse(store[Storage.LS_CHAT_KEY]).messages
    expect(stored).toHaveLength(Storage.CHAT_QUOTA_FALLBACK_MESSAGES)
    expect(stored.at(-1).seq).toBe(400)
  })

  it('ignores a record written by an older version', () => {
    stubLocalStorage({ [Storage.LS_CHAT_KEY]: JSON.stringify({ version: 0, messages: chat.messages }) })
    expect(Storage.loadChat()).toBeNull()
  })

  it('reads nothing at all as no chat, without throwing', () => {
    stubLocalStorage()
    expect(Storage.loadChat()).toBeNull()

    stubLocalStorage({ [Storage.LS_CHAT_KEY]: '{not json' })
    expect(Storage.loadChat()).toBeNull()
  })

  it('forgets the chat once it is closed', () => {
    const store = stubLocalStorage()
    Storage.saveChat(chat)
    Storage.clearChat()
    expect(store[Storage.LS_CHAT_KEY]).toBeUndefined()
    expect(Storage.loadChat()).toBeNull()
  })
})
