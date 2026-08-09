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

describe('Session.restorableMessages', () => {
  // Without the presence events the resumed run has nobody on record as
  // already present, and announces the whole cast a second time.
  it('keeps presence events, which carry no text at all', () => {
    const joined = { role: 'participant_joined', content: '', participantSnapshot: { id: 0, name: 'Alpha' } }
    const left = { role: 'participant_left', content: '', participantSnapshot: { id: 1, name: 'Beta' } }

    expect(Session.restorableMessages([joined, left])).toEqual([joined, left])
  })

  it('moves a legacy reasoning block out of the restored message', () => {
    expect(Session.restorableMessages([
      { role: 'A', content: '<reasoning>Я анализирую.</reasoning>Ecco il contributo.' },
    ])).toEqual([
      { role: 'A', content: 'Ecco il contributo.', thinking: 'Я анализирую.' },
    ])
  })

  it('still drops a turn that produced nothing', () => {
    expect(Session.restorableMessages([
      { role: 'assistant', content: '   ' },
      { role: 'assistant', content: 'A real contribution.', ollamaRole: 'assistant' },
    ])).toEqual([{ role: 'assistant', content: 'A real contribution.' }])
  })
})
