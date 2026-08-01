import { describe, expect, it } from 'vitest'
import { Debate } from '../src/debate/Debate'

const msg = (role, size) => ({ role, content: 'x'.repeat(size) })

describe('Debate.capContextMessages', () => {
  it('keeps everything when it already fits', () => {
    const messages = [msg('user', 10), msg('assistant', 10)]
    expect(Debate.capContextMessages(messages, 100)).toEqual(messages)
  })

  it('drops the oldest messages to stay inside the budget', () => {
    const oldest = msg('user', 60)
    const middle = msg('assistant', 30)
    const newest = msg('user', 30)

    expect(Debate.capContextMessages([oldest, middle, newest], 100)).toEqual([middle, newest])
  })

  it('always keeps the newest message even when it alone exceeds the budget', () => {
    // The turn being answered must survive, otherwise the payload loses the
    // very message the participant has to reply to.
    const huge = msg('user', 5000)
    expect(Debate.capContextMessages([msg('user', 40), huge], 100)).toEqual([huge])
  })

  it('preserves order of the kept messages', () => {
    const a = msg('user', 40)
    const b = msg('assistant', 40)
    const c = msg('user', 40)
    expect(Debate.capContextMessages([a, b, c], 90).map(m => m.content.length)).toEqual([40, 40])
    expect(Debate.capContextMessages([a, b, c], 90)).toEqual([b, c])
  })

  it('treats a missing or non-positive budget as unlimited', () => {
    const messages = [msg('user', 5000), msg('assistant', 5000)]
    expect(Debate.capContextMessages(messages, 0)).toEqual(messages)
    expect(Debate.capContextMessages(messages)).toEqual(messages)
    expect(Debate.capContextMessages(messages, Number.NaN)).toEqual(messages)
  })

  it('tolerates empty input and missing content', () => {
    expect(Debate.capContextMessages([], 100)).toEqual([])
    expect(Debate.capContextMessages(null, 100)).toEqual([])
    expect(Debate.capContextMessages([{ role: 'user' }], 100)).toEqual([{ role: 'user' }])
  })
})
