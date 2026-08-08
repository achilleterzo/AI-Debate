import { describe, expect, it } from 'vitest'
import { Debate } from '../src/debate/Debate'

const roster = [
  { id: 0, tag: 'A', isModerator: false },
  { id: 1, tag: 'M', isModerator: true },
  { id: 2, tag: 'B', isModerator: false },
  { id: 3, tag: 'C', isModerator: false },
]

// Deterministic stand-in for Math.random: replays the given values in order.
function sequence(values) {
  let index = 0
  return () => values[index++ % values.length]
}

describe('buildRoundOrder', () => {
  it('keeps the configured order when randomization is off', () => {
    expect(Debate.buildRoundOrder(roster)).toEqual([0, 1, 2, 3])
    expect(Debate.buildRoundOrder(roster, { randomize: false })).toEqual([0, 1, 2, 3])
  })

  it('leaves the moderator in its own slot', () => {
    for (let run = 0; run < 50; run += 1) {
      const order = Debate.buildRoundOrder(roster, { randomize: true })
      expect(order[1]).toBe(1)
      expect([...order].sort()).toEqual([0, 1, 2, 3])
    }
  })

  it('shuffles the other participants among the free slots', () => {
    // Fisher-Yates over the movable ids [0, 2, 3]: index 2 swaps with 0 giving
    // [3, 2, 0], then index 1 swaps with 0 giving [2, 3, 0]. Those refill the
    // non-moderator slots in order, so the moderator stays second.
    const order = Debate.buildRoundOrder(roster, { randomize: true, random: sequence([0, 0]) })
    expect(order).toEqual([2, 1, 3, 0])
  })

  it('produces more than one arrangement across rounds', () => {
    const seen = new Set()
    for (let run = 0; run < 200; run += 1) {
      seen.add(Debate.buildRoundOrder(roster, { randomize: true }).join(','))
    }
    expect(seen.size).toBeGreaterThan(1)
  })

  it('handles rosters too small or made only of moderators', () => {
    expect(Debate.buildRoundOrder([], { randomize: true })).toEqual([])
    expect(Debate.buildRoundOrder([{ id: 7, isModerator: false }], { randomize: true })).toEqual([7])
    const moderatorsOnly = [{ id: 0, isModerator: true }, { id: 1, isModerator: true }]
    expect(Debate.buildRoundOrder(moderatorsOnly, { randomize: true })).toEqual([0, 1])
  })
})

describe('buildRoundOrder across the round boundary', () => {
  const plainRoster = [
    { id: 0, tag: 'A', isModerator: false },
    { id: 1, tag: 'B', isModerator: false },
    { id: 2, tag: 'C', isModerator: false },
  ]

  it('never opens a round with whoever closed the previous one', () => {
    for (let run = 0; run < 200; run += 1) {
      for (const lastSpeakerId of [0, 1, 2]) {
        const order = Debate.buildRoundOrder(plainRoster, { randomize: true, lastSpeakerId })
        expect(order[0], `last ${lastSpeakerId}`).not.toBe(lastSpeakerId)
        expect([...order].sort()).toEqual([0, 1, 2])
      }
    }
  })

  it('still lets the previous closer speak later in the round', () => {
    const positions = new Set()
    for (let run = 0; run < 200; run += 1) {
      positions.add(Debate.buildRoundOrder(plainRoster, { randomize: true, lastSpeakerId: 0 }).indexOf(0))
    }
    expect(positions.has(0)).toBe(false)
    expect(positions.size).toBeGreaterThan(1)
  })

  const moderatorFirst = [
    { id: 0, tag: 'M', isModerator: true },
    { id: 1, tag: 'A', isModerator: false },
    { id: 2, tag: 'B', isModerator: false },
    { id: 3, tag: 'C', isModerator: false },
  ]

  it('leaves the moderator in its own slot, which is fixed by design', () => {
    for (let run = 0; run < 50; run += 1) {
      expect(Debate.buildRoundOrder(moderatorFirst, { randomize: true, lastSpeakerId: 0 })[0]).toBe(0)
    }
  })

  // A moderator in front does not make a repeat inaudible: it holds a fixed
  // slot and often skips its turn, so the participant right after it is the
  // one the table hears open the round.
  it('protects the first shuffled slot even behind a moderator', () => {
    for (let run = 0; run < 200; run += 1) {
      for (const lastSpeakerId of [1, 2, 3]) {
        const order = Debate.buildRoundOrder(moderatorFirst, { randomize: true, lastSpeakerId })
        expect(order[1], `last ${lastSpeakerId}`).not.toBe(lastSpeakerId)
        expect(order[0]).toBe(0)
        expect([...order].sort()).toEqual([0, 1, 2, 3])
      }
    }
  })

  it('still protects the first slot when the moderator sits mid-round', () => {
    const moderatorSecond = [
      { id: 0, tag: 'A', isModerator: false },
      { id: 1, tag: 'M', isModerator: true },
      { id: 2, tag: 'B', isModerator: false },
    ]
    for (let run = 0; run < 200; run += 1) {
      expect(Debate.buildRoundOrder(moderatorSecond, { randomize: true, lastSpeakerId: 2 })[0]).not.toBe(2)
    }
  })

  it('has nothing to correct with a single movable participant', () => {
    const roster = [{ id: 0, isModerator: true }, { id: 1, isModerator: false }]
    expect(Debate.buildRoundOrder(roster, { randomize: true, lastSpeakerId: 1 })).toEqual([0, 1])
  })
})
