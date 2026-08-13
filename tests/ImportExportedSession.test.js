import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { Session } from '../src/data/Session'
import { Debate } from '../src/debate/Debate'

const EXPORT_PATH = 'examples/Design Review/ai-debate-facciamo-un-analisi-per-valore-ed-originalità-IT.json'
const SNAPSHOT_PATH = 'examples/Design Review/ai-debate-design-review-IT.json'

const read = path => JSON.parse(fs.readFileSync(path, 'utf8'))
const exported = read(EXPORT_PATH)
const snapshot = read(SNAPSHOT_PATH)
const adopt = data => Session.fromExportedSession(data, Debate.sessionConstants())

describe('Session.isExportedSession', () => {
  it('tells the two formats apart', () => {
    expect(Session.isExportedSession(exported)).toBe(true)
    expect(Session.isExportedSession(snapshot)).toBe(false)
  })

  it('needs a transcript, so an unrelated JSON is not mistaken for one', () => {
    expect(Session.isExportedSession({ exported: '2026-01-01', appVersion: '2.2.1' })).toBe(false)
    expect(Session.isExportedSession({ messages: [] })).toBe(false)
    expect(Session.isExportedSession(null)).toBe(false)
    // A snapshot is stamped with its version even when it carries the rest.
    expect(Session.isExportedSession({ ...exported, version: 2 })).toBe(false)
  })
})

describe('Session.fromExportedSession', () => {
  const adopted = adopt(exported)

  it('passes the version gate the loader checks', () => {
    expect(adopted.version).toBe(2)
  })

  it('recovers the topic from the opening message', () => {
    expect(adopted.topic).toBe(exported.messages.find(message => message.role === 'topic').content)
    expect(adopted.topic).toContain('AI Debate')
  })

  it('keeps the whole transcript and renumbers id into seq', () => {
    expect(adopted.messages).toHaveLength(exported.messages.length)
    expect(adopted.messages.every(message => message.seq != null)).toBe(true)
    expect(adopted.messages[0].seq).toBe(exported.messages[0].id)
    // Fields the timeline derives for itself do not survive as stale copies.
    expect(adopted.messages.every(message => !('actor' in message) && !('kind' in message))).toBe(true)
  })

  it('puts a participant snapshot back on presence events, which have no tag', () => {
    const presence = adopted.messages.filter(message => message.role === 'participant_joined')
    expect(presence.length).toBeGreaterThan(0)
    // Without this the timeline renders the chip as "?".
    expect(presence.every(message => message.participantSnapshot?.name)).toBe(true)
    expect(presence.every(message => message.participantSnapshot?.label)).toBe(true)
  })

  it('stamps ordinary turns with the participant holding their tag', () => {
    const spoken = adopted.messages.find(message => message.role === 'A' && message.content)
    expect(spoken.participantSnapshot.tag).toBe('A')
    expect(spoken.participantSnapshot.name).toBe(exported.participants[0].name)
  })

  it('carries the conclusions and the summary through untouched', () => {
    expect(adopted.conclusions).toEqual(exported.conclusions)
    expect(adopted.summary).toBe(exported.summary)
  })

  it('resumes at the highest round the transcript reached', () => {
    const rounds = exported.messages.map(message => message.turn).filter(Number.isFinite)
    expect(adopted.turn).toEqual({ round: Math.max(...rounds), step: 0 })
  })

  it('clears the memory rather than crediting the current one to the import', () => {
    expect(adopted.memory).toEqual([])
  })

  it('leaves out the settings an export never carried, so the loader skips them', () => {
    for (const field of ['globalConstraints', 'generalPersonalityInstructions', 'maxTurns', 'timeoutSec', 'moderationCooling', 'useSummary', 'summarizeAttachments', 'customConclusionPrompt', 'standardConclusionPrompt']) {
      expect(adopted[field]).toBeUndefined()
    }
  })
})

describe('participants read back from an export', () => {
  const hydrated = Debate.hydrateParticipantsFromSession(adopt(exported).participants)

  it('undoes the label the export wrote for verbosity', () => {
    expect(exported.participants[0].responseLength).toBe('Verbosity: free')
    // `free` means no preference, which the app stores as null.
    expect(hydrated[0].responseLength).toBeNull()
    expect(hydrated.every(participant => !String(participant.responseLength ?? '').includes('Verbosity'))).toBe(true)
  })

  it('maps the fields the export renamed', () => {
    const source = exported.participants[0]
    expect(source.education).toBe('academic')
    expect(hydrated[0].educationLevel).toBe('academic')
    expect(hydrated[0].ageGroup).toBe(source.age)
    expect(hydrated[0].mood).toBe(source.mood)
  })

  it('treats the export placeholder character type as none', () => {
    expect(exported.participants[0].characterType).toBe('person')
    expect(hydrated[0].characterType).toBeNull()
  })

  it('keeps tags, names and the moderator flag', () => {
    expect(hydrated.map(participant => participant.tag)).toEqual(exported.participants.map(participant => participant.tag))
    expect(hydrated.map(participant => participant.name)).toEqual(exported.participants.map(participant => participant.name))
    expect(hydrated[0].isModerator).toBe(true)
  })

  it('comes back without the state an export does not hold', () => {
    expect(hydrated.every(participant => participant.model === '')).toBe(true)
    expect(hydrated.every(participant => participant.constraints.length === 0)).toBe(true)
  })
})

describe('an export with nothing in it', () => {
  it('adopts an empty transcript without throwing', () => {
    const adopted = adopt({ exported: '2026-01-01T00:00:00.000Z', messages: [] })
    expect(adopted.version).toBe(2)
    expect(adopted.topic).toBe('')
    expect(adopted.messages).toEqual([])
    expect(adopted.participants).toEqual([])
    expect(adopted.turn).toBeNull()
  })
})
