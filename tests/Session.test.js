import { describe, expect, it } from 'vitest'
import { Session } from '../src/data/Session'

describe('Session.stripDebugFields', () => {
  it('removes legacy transport roles from persisted messages', () => {
    expect(Session.stripDebugFields([{
      role: 'topic',
      ollamaRole: 'user',
      payload: { ignored: true },
      debugPayloads: [],
      content: 'Discuss the proposal',
    }])).toEqual([{
      role: 'topic',
      content: 'Discuss the proposal',
    }])
  })
})
