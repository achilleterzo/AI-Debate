import { describe, expect, it } from 'vitest'
import { Debate } from '../src/debate/Debate'

const moderator = { id: 0, tag: 'M', isModerator: true, moderatorMode: 'containment' }
const speaker = { id: 1, tag: 'A', name: 'Alice', isModerator: false }
const participants = [moderator, speaker]
const historyWithContext = [{ role: 'A', content: 'An argument', turn: 1 }]

function decide(mode, { actorOverrides = {}, ...extra } = {}) {
  return Debate.shouldModeratorIntervene({
    actor: { ...moderator, moderatorMode: mode, ...actorOverrides },
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

  it('facilitator defaults to a scheduled turn every round', () => {
    for (const round of [0, 1, 2]) {
      const result = decide('facilitator', { round, roundLimit: 6 })
      expect(result.shouldIntervene, `round ${round}`).toBe(true)
      expect(result.scheduledFacilitation, `round ${round}`).toBe(true)
    }
  })

  it('facilitator follows the configured interval, last round included', () => {
    const every2 = { moderatorFacilitationInterval: 2 }

    // round is 0-indexed: round 1 → turn 2 (scheduled)
    const scheduled = decide('facilitator', { round: 1, roundLimit: 6, actorOverrides: every2 })
    expect(scheduled.shouldIntervene).toBe(true)
    expect(scheduled.scheduledFacilitation).toBe(true)

    // round 0 → turn 1 (odd, not scheduled)
    expect(decide('facilitator', { round: 0, roundLimit: 6, actorOverrides: every2 }).shouldIntervene).toBe(false)

    // round 3 → turn 4 with roundLimit 4: the cadence holds on the last round
    const lastRound = decide('facilitator', { round: 3, roundLimit: 4, actorOverrides: every2 })
    expect(lastRound.shouldIntervene).toBe(true)
    expect(lastRound.scheduledFacilitation).toBe(true)

    // an interval as long as the debate still gets its one facilitation
    const every6 = { moderatorFacilitationInterval: 6 }
    expect(decide('facilitator', { round: 5, roundLimit: 6, actorOverrides: every6 }).scheduledFacilitation).toBe(true)

    // an interval of 3 fires on turns 3 and 6
    const every3 = { moderatorFacilitationInterval: 3 }
    expect(decide('facilitator', { round: 1, roundLimit: 8, actorOverrides: every3 }).scheduledFacilitation).toBe(false)
    expect(decide('facilitator', { round: 2, roundLimit: 8, actorOverrides: every3 }).scheduledFacilitation).toBe(true)
    expect(decide('facilitator', { round: 5, roundLimit: 8, actorOverrides: every3 }).scheduledFacilitation).toBe(true)

    // out-of-range values fall back into the supported 1..6 window
    expect(decide('facilitator', { round: 0, roundLimit: 6, actorOverrides: { moderatorFacilitationInterval: 99 } }).scheduledFacilitation).toBe(false)
    expect(decide('facilitator', { round: 5, roundLimit: 8, actorOverrides: { moderatorFacilitationInterval: 99 } }).scheduledFacilitation).toBe(true)

    // containment triggers still apply on non-scheduled rounds
    const triggered = decide('facilitator', { round: 0, roundLimit: 6, actorOverrides: every2, roundModerationSignal: { needed: true } })
    expect(triggered.shouldIntervene).toBe(true)
    expect(triggered.scheduledFacilitation).toBe(false)
  })

  it('active intervenes whenever there is context', () => {
    expect(decide('active').shouldIntervene).toBe(true)
  })

  it('reacts to a direct personal attack in every moderator style', () => {
    const history = [{ role: 'A', content: 'Smettila, sei ridicola.', turn: 1 }]
    for (const mode of Debate.MODERATOR_MODES) {
      const result = Debate.shouldModeratorIntervene({
        actor: { ...moderator, moderatorMode: mode },
        history,
        participants,
        round: 0,
        roundLimit: 6,
      })
      expect(result.shouldIntervene, mode).toBe(true)
      expect(result.reactiveModeration, mode).toBe(true)
      expect(result.scheduledFacilitation, mode).toBe(false)
    }
  })

  it('uses permissiveness to distinguish explicit abuse from milder hostility', () => {
    const mildHostility = [{ role: 'A', content: 'Alice, ma quale ragionamento stai facendo?', turn: 1 }]
    const explicitAbuse = [{ role: 'A', content: 'Sei idiota.', turn: 1 }]

    expect(Debate.hasDirectPersonalAttack(mildHostility, participants, 'M', 0)).toBe(false)
    expect(Debate.hasDirectPersonalAttack(mildHostility, participants, 'M', 4)).toBe(true)
    expect(Debate.hasDirectPersonalAttack(explicitAbuse, participants, 'M', 0)).toBe(true)
  })
})
