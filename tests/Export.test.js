import { describe, expect, it, vi } from 'vitest'
import { Data } from '../src/data/Data'

const constants = {
  MOODS: [{ id: 'none', label: 'Neutral', emoji: '' }],
  MOOD_INTENSITY: [{ label: 'Balanced' }],
  DEFAULT_MOOD_INTENSITY: 0,
  AGE_GROUPS: [{ label: 'Adult' }],
  DEFAULT_AGE_GROUP: 0,
  EDUCATION_LEVELS: [{ value: null, label: 'Model default' }],
  CHARACTER_TYPES: [{ value: null, label: 'Person' }],
  RESPONSE_LENGTHS: [{ value: 'short', label: 'Short' }],
}

const participants = [
  { id: 0, tag: 'A', name: 'Alice', mood: 'none' },
  { id: 1, tag: 'B', name: 'Bob', mood: 'none' },
]

const messages = [
  { role: 'topic', content: 'Nuclear power', turn: 0, seq: 0 },
  { role: 'A', content: 'It is safe enough.', turn: 1, seq: 1 },
]

function exported(method, extra = {}) {
  const download = vi.spyOn(Data, 'triggerDownload').mockImplementation(() => {})
  method({ messages, participants, baseUrl: 'http://localhost:11434', constants, ...extra })
  const [content] = download.mock.calls[0]
  download.mockRestore()
  return content
}

describe('export header', () => {
  it('shows the debate language next to the mode in HTML', () => {
    const html = Data.buildHTML({ messages, participants, baseUrl: '', constants, debateMode: 'free', uiLang: 'it' })
    expect(html).toContain('<strong>Debate mode:</strong> Free')
    expect(html).toContain('<strong>Language:</strong> Italiano (IT)')
  })

  it('shows a custom language as typed, with no ISO code to quote', () => {
    const html = Data.buildHTML({ messages, participants, baseUrl: '', constants, uiLang: 'Napoletano' })
    expect(html).toContain('<strong>Language:</strong> Napoletano')
  })

  it('leaves the header alone when no language is known', () => {
    const html = Data.buildHTML({ messages, participants, baseUrl: '', constants })
    expect(html).toContain('<strong>Debate mode:</strong>')
    expect(html).not.toContain('Language:')
  })

  it('shows the language on the mode line in Markdown', () => {
    const markdown = exported(Data.exportMD, { debateMode: 'decision', uiLang: 'en' })
    expect(markdown).toContain('**Debate mode:** Decision · **Language:** English (EN)')
  })

  it('carries both the code and the label in JSON', () => {
    const data = JSON.parse(exported(Data.exportJSON, { debateMode: 'free', uiLang: 'it' }))
    expect(data.language).toBe('it')
    expect(data.languageLabel).toBe('Italiano (IT)')
  })

  it('nulls the JSON language fields when there is none', () => {
    const data = JSON.parse(exported(Data.exportJSON, {}))
    expect(data.language).toBeNull()
    expect(data.languageLabel).toBeNull()
  })
})
