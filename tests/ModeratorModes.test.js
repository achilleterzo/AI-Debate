import { describe, expect, it } from 'vitest'
import { Debate } from '../src/debate/Debate'

const moderator = { id: 0, tag: 'M', isModerator: true, moderatorMode: 'containment' }
const speaker = { id: 1, tag: 'A', isModerator: false }
const participants = [moderator, speaker]
const historyWithContext = [{ role: 'A', content: 'An argument', turn: 1 }]

function decide(mode, extra = {}) {
  return Debate.shouldModeratorIntervene({
    actor: { ...moderator, moderatorMode: mode },
    history: historyWithContext,
    participants,
    ...extra,
  })
}

describe('normalizeModeratorMode', () => {
  it('keeps a valid explicit mode', () => {
    expect(Debate.normalizeModeratorMode({ moderatorMode: 'facilitator' })).toBe('facilitator')
  })

  it('migrates the legacy always-intervene flag', () => {
    expect(Debate.normalizeModeratorMode({ moderatorAlwaysIntervene: true })).toBe('active')
    expect(Debate.normalizeModeratorMode({ moderatorAlwaysIntervene: false })).toBe('containment')
    expect(Debate.normalizeModeratorMode({})).toBe('containment')
  })
})

describe('shouldModeratorIntervene by mode', () => {
  it('never intervenes without non-moderator context', () => {
    const result = Debate.shouldModeratorIntervene({
      actor: { ...moderator, moderatorMode: 'active' },
      history: [],
      participants,
    })
    expect(result.shouldIntervene).toBe(false)
  })

  it('containment intervenes only on a concrete moderation signal', () => {
    expect(decide('containment').shouldIntervene).toBe(false)
    expect(decide('containment', { roundModerationSignal: { needed: true } }).shouldIntervene).toBe(true)
  })

  it('facilitator intervenes on even rounds except the last one', () => {
    // round is 0-indexed: round 1 → turn 2 (scheduled)
    const scheduled = decide('facilitator', { round: 1, roundLimit: 6 })
    expect(scheduled.shouldIntervene).toBe(true)
    expect(scheduled.scheduledFacilitation).toBe(true)

    // round 0 → turn 1 (odd, not scheduled)
    expect(decide('facilitator', { round: 0, roundLimit: 6 }).shouldIntervene).toBe(false)

    // round 3 → turn 4 with roundLimit 4: last round, not scheduled
    const lastRound = decide('facilitator', { round: 3, roundLimit: 4 })
    expect(lastRound.shouldIntervene).toBe(false)

    // containment triggers still apply on non-scheduled rounds
    const triggered = decide('facilitator', { round: 0, roundLimit: 6, roundModerationSignal: { needed: true } })
    expect(triggered.shouldIntervene).toBe(true)
    expect(triggered.scheduledFacilitation).toBe(false)
  })

  it('active intervenes whenever there is context', () => {
    expect(decide('active').shouldIntervene).toBe(true)
  })
})
