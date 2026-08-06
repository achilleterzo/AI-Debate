import { describe, expect, it } from 'vitest'
import { Debate } from '../src/debate/Debate'

describe('Debate participant domain rules', () => {
  it('accepts the configured default model when a participant has no individual model', () => {
    expect(Debate.hasConfiguredModel({ model: '' }, 'model-a')).toBe(true)
    expect(Debate.hasConfiguredModel({ model: '' }, '')).toBe(false)
  })

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
      constraints: [{ text: 'Use sources', override: false }],
    })
  })
})

describe('Debate summary and affinity rules', () => {
  it('parses a summary bundle and rejects incomplete payloads', () => {
    const bundle = Debate.parseSummaryAffinityBundle('```json\n{"summary":"Round summary","affinity_deltas":{"alpha":{"beta":0.25}},"moderation":{"needed":true,"reason":"topic drift","targets":["beta"]}}\n```')

    expect(bundle).toEqual({
      summary: 'Round summary',
      deltas: { alpha: { beta: 0.25 } },
      moderation: { needed: true, reason: 'topic drift', targets: ['beta'] },
    })
    expect(Debate.parseSummaryAffinityBundle('{"summary":""}')).toBeNull()
  })

  it('applies deltas, respects affinity locks, and cools untouched affinities', () => {
    const participants = [
      { id: 0, tag: 'alpha', affinity: { 1: 0.8, 2: -0.5 }, affinityLocks: { 2: true } },
      { id: 1, tag: 'beta', affinity: { 0: 0.4 }, affinityLocks: {} },
      { id: 3, tag: 'gamma', affinity: { 0: -0.8 }, affinityLocks: {} },
      { id: 2, tag: 'moderator', isModerator: true, moderatorDynamicAffinity: false, affinity: {}, affinityLocks: {} },
    ]

    const result = Debate.applyDynamicAffinityUpdates({
      participants,
      deltas: { alpha: { beta: 0.5, moderator: 0.4 } },
      moderatorIntervention: true,
      moderationTargets: ['beta'],
      moderationCooling: 0.15,
    })

    expect(result.changed).toBe(true)
    expect(result.participants[0].affinity).toEqual({ 1: 1, 2: -0.5 })
    expect(result.participants[1].affinity).toEqual({ 0: 0.25 })
    expect(result.participants[2].affinity).toEqual({ 0: -0.8 })
    expect(result.participants[2]).toBe(participants[2])
    expect(result.participants[3]).toBe(participants[3])
  })

  it('cools every participant explicitly targeted by a multi-person moderation', () => {
    const participants = [
      { id: 0, tag: 'alpha', affinity: { 1: 0.8, 2: 0.6 }, affinityLocks: {} },
      { id: 1, tag: 'beta', affinity: { 0: 0.4 }, affinityLocks: {} },
      { id: 2, tag: 'gamma', affinity: { 0: -0.8 }, affinityLocks: {} },
      { id: 3, tag: 'moderator', isModerator: true, affinity: {}, affinityLocks: {} },
    ]

    const result = Debate.applyDynamicAffinityUpdates({
      participants,
      moderatorIntervention: true,
      moderationTargets: ['beta', 'gamma'],
      moderationCooling: 0.15,
    })

    expect(result.participants[0]).toBe(participants[0])
    expect(result.participants[1].affinity).toEqual({ 0: 0.25 })
    expect(result.participants[2].affinity).toEqual({ 0: -0.65 })
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

describe('Debate participant ordering', () => {
  it('changes display order without changing participant identities or affinities', () => {
    const alpha = { id: 0, tag: 'A', name: 'Alpha', affinity: { 1: 0.5 } }
    const beta = { id: 1, tag: 'B', name: 'Beta', affinity: { 0: -0.5 } }
    const reordered = Debate.reorderParticipants([alpha, beta], 0, 1)

    expect(reordered).toEqual([beta, alpha])
    expect(reordered[0]).toBe(beta)
    expect(reordered[1]).toBe(alpha)
  })
})

describe('Debate topic variations', () => {
  it('keeps topic directives separate from transport roles', () => {
    let sequence = 0
    const initial = Debate.createInitialHistory({
      injectTopic: 'Discuss renewable energy',
      round: 0,
      nextSeq: () => ++sequence,
    })

    expect(initial.history).toEqual([{
      role: 'topic',
      content: 'Discuss renewable energy',
      turn: 0,
      seq: 1,
    }])
    expect(initial.history[0]).not.toHaveProperty('ollamaRole')
  })

  it('persists multiple queued variations without duplicating them', () => {
    const first = { role: 'interjection', content: 'Focus on costs', seq: 10, pending: true }
    const second = { role: 'interjection', content: 'Include environmental impact', seq: 11, pending: true }
    const history = Debate.appendInterjection([], first)
    const withBoth = Debate.appendInterjection(history, second)

    expect(withBoth).toEqual([
      { ...first, pending: false },
      { ...second, pending: false },
    ])
    expect(Debate.appendInterjection(withBoth, second)).toBe(withBoth)
    expect(Debate.getActiveTopicMessage(withBoth)?.content).toBe('Include environmental impact')
  })
})

describe('Debate context windows', () => {
  const history = [
    { role: 'topic', content: 'Initial topic' },
    { role: 'A', content: 'A opening' },
    { role: 'B', content: 'B reply' },
    { role: 'participant_joined', content: '' },
    { role: 'interjection', content: 'Focus on evidence' },
    { role: 'A', content: 'A follow-up' },
    { role: 'error', content: 'boom' },
    { role: 'B', content: 'B latest reply' },
  ]

  it('keeps the last messages in chronological order, whoever wrote them', () => {
    expect(Debate.getRecentContext(history, 2)).toEqual([
      { role: 'topic', content: 'Initial topic' },
      { role: 'A', content: 'A opening' },
      { role: 'B', content: 'B reply' },
      { role: 'interjection', content: 'Focus on evidence' },
      { role: 'A', content: 'A follow-up' },
      { role: 'B', content: 'B latest reply' },
    ])
  })

  it('drops lifecycle and error entries before counting, so the window holds real turns', () => {
    const window = Debate.getRecentContext(history, 3)
    expect(window).toHaveLength(6)
    expect(window.some(message => ['error', 'participant_joined', 'participant_left'].includes(message.role))).toBe(false)
  })

  it('never goes below the floor, however small the roster', () => {
    expect(Debate.getRecentContext(history, 0)).toHaveLength(Debate.RECENT_CONTEXT_MIN_MESSAGES)
    expect(Debate.getRecentContext(history, 1)).toHaveLength(Debate.RECENT_CONTEXT_MIN_MESSAGES)
    expect(Debate.getRecentContext(history)).toHaveLength(Debate.RECENT_CONTEXT_MIN_MESSAGES)
  })

  it('widens with the roster instead of tracking a single participant', () => {
    const long = Array.from({ length: 30 }, (_, index) => ({ role: index % 2 ? 'A' : 'B', content: `msg ${index}` }))
    expect(Debate.getRecentContext(long, 8)).toHaveLength(8)
    expect(Debate.getRecentContext(long, 8).at(-1)).toEqual({ role: 'A', content: 'msg 29' })
    expect(Debate.getRecentContext(long, 12)).toHaveLength(12)
  })

  it('returns what it has when the history is shorter than the window', () => {
    expect(Debate.getRecentContext([{ role: 'A', content: 'only one' }], 4)).toEqual([{ role: 'A', content: 'only one' }])
    expect(Debate.getRecentContext([], 4)).toEqual([])
  })
})

describe('summary system prompts and the output language', () => {
  const languages = [{ code: 'it', label: 'Italiano' }]

  it('quotes the ISO code of a language taken from the list', () => {
    expect(Debate.buildRoundSummarySystemPrompt('it', languages)).toContain('Write in Italiano (language code: it).')
    expect(Debate.buildDocumentSummarySystemPrompt('it', languages)).toContain('Write in Italiano (language code: it).')
  })

  it('names a custom language on its own, with no code to quote', () => {
    const prompt = Debate.buildRoundSummarySystemPrompt('Napoletano', languages)
    expect(prompt).toContain('Write in Napoletano.')
    expect(prompt).not.toContain('language code')
  })
})
