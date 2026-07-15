import { describe, expect, it } from 'vitest'
import { Debate } from '../src/debate/Debate'

describe('Debate participant domain rules', () => {
  it('normalizes affinity maps, removing invalid and neutral entries', () => {
    expect(Debate.normalizeAffinity({ 1: '1.234', 2: -2, three: 0.5, 4: 0 })).toEqual({ 1: 1, 2: -1 })
    expect(Debate.normalizeAffinity(['2', 'invalid', 3])).toEqual({ 2: 1, 3: 1 })
    expect(Debate.normalizeAffinityLocks({ 1: true, 2: false, invalid: true })).toEqual({ 1: true })
  })

  it('hydrates legacy moderators and resets their legacy mood', () => {
    const [participant] = Debate.hydrateParticipantsFromSession([{
      model: 'model-a',
      mood: 'moderator',
      affinity: { 1: 0.333 },
      affinityLocks: { 1: true },
    }])

    expect(participant).toMatchObject({
      id: 0,
      model: 'model-a',
      isModerator: true,
      mood: Debate.DEFAULT_MOOD,
      affinity: { 1: 0.33 },
      affinityLocks: { 1: true },
    })
  })

  it('reindexes participants while retaining normalized settings', () => {
    const participants = [{
      ...Debate.mkParticipant(5, 'model-a'),
      name: 'Ada',
      endpointOverride: 'http://remote',
      affinity: { 1: 0.2 },
      affinityLocks: { 1: true },
      constraints: ['Use sources'],
    }]

    expect(Debate.reindexParticipants(participants)[0]).toMatchObject({
      id: 0,
      model: 'model-a',
      name: 'Ada',
      endpointOverride: 'http://remote',
      affinity: { 1: 0.2 },
      affinityLocks: { 1: true },
      constraints: ['Use sources'],
    })
  })
})

describe('Debate summary and affinity rules', () => {
  it('parses a summary bundle and rejects incomplete payloads', () => {
    const bundle = Debate.parseSummaryAffinityBundle('```json\n{"summary":"Round summary","affinity_deltas":{"alpha":{"beta":0.25}},"moderation":{"needed":true,"reason":"topic drift"}}\n```')

    expect(bundle).toEqual({
      summary: 'Round summary',
      deltas: { alpha: { beta: 0.25 } },
      moderation: { needed: true, reason: 'topic drift' },
    })
    expect(Debate.parseSummaryAffinityBundle('{"summary":""}')).toBeNull()
  })

  it('applies deltas, respects affinity locks, and cools untouched affinities', () => {
    const participants = [
      { id: 0, tag: 'alpha', affinity: { 1: 0.8, 2: -0.5 }, affinityLocks: { 2: true } },
      { id: 1, tag: 'beta', affinity: { 0: 0.4 }, affinityLocks: {} },
      { id: 2, tag: 'moderator', isModerator: true, moderatorDynamicAffinity: false, affinity: {}, affinityLocks: {} },
    ]

    const result = Debate.applyDynamicAffinityUpdates({
      participants,
      deltas: { alpha: { beta: 0.5, moderator: 0.4 } },
      moderatorIntervention: true,
      moderationCooling: 0.15,
    })

    expect(result.changed).toBe(true)
    expect(result.participants[0].affinity).toEqual({ 1: 1, 2: -0.5 })
    expect(result.participants[1].affinity).toEqual({ 0: 0.25 })
    expect(result.participants[2]).toBe(participants[2])
  })
})

describe('Debate participant lifecycle messages', () => {
  it('waits for a newly added participant to reach their turn before joining', () => {
    const alphaBefore = { id: 0, tag: 'alpha', model: 'model-a', name: 'Alpha' }
    const alphaAfter = { ...alphaBefore, name: 'Renamed Alpha' }
    const beta = { id: 1, tag: 'beta', model: 'model-b', name: 'Beta' }
    const history = [{ role: 'participant_joined', participantSnapshot: alphaBefore }]
    let sequence = 10

    const betaMessages = Debate.buildParticipantLifecycleMessages({
      history,
      participants: [alphaAfter, beta],
      actor: beta,
      turn: 2,
      nextSeq: () => ++sequence,
    })

    expect(betaMessages).toMatchObject([
      { role: 'participant_joined', turn: 2, participantSnapshot: beta },
    ])

    const alphaMessages = Debate.buildParticipantLifecycleMessages({
      history: [...history, ...betaMessages],
      participants: [alphaAfter, beta],
      actor: alphaAfter,
      turn: 3,
      nextSeq: () => ++sequence,
    })

    expect(alphaMessages).toMatchObject([
      { role: 'participant_left', turn: 3, participantSnapshot: alphaBefore },
      { role: 'participant_joined', turn: 3, participantSnapshot: alphaAfter },
    ])
  })

  it('emits each departure once at the next turn boundary', () => {
    const alpha = { id: 0, tag: 'alpha', model: 'model-a', name: 'Alpha' }
    const beta = { id: 1, tag: 'beta', model: 'model-b', name: 'Beta' }
    const history = [
      { role: 'participant_joined', participantSnapshot: alpha },
      { role: 'participant_joined', participantSnapshot: beta },
    ]
    let sequence = 20
    const args = {
      participants: [alpha],
      actor: alpha,
      turn: 4,
      nextSeq: () => ++sequence,
    }

    const first = Debate.buildParticipantLifecycleMessages({ history, ...args })
    const second = Debate.buildParticipantLifecycleMessages({ history: [...history, ...first], ...args })

    expect(first).toMatchObject([{ role: 'participant_left', turn: 4, participantSnapshot: beta }])
    expect(second).toEqual([])
  })
})
