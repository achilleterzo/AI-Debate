import { describe, expect, it } from 'vitest'
import { buildModeDraftPrompt, buildModeDraftSystemPrompt, parseModeDraft } from '../src/services/ModeDraft'

describe('mode draft prompts', () => {
  it('asks for the name in the interface language and the purposes in English', () => {
    const system = buildModeDraftSystemPrompt({ languageNamed: 'Italian' })
    expect(system).toContain('"name" value in Italian')
    expect(system).toContain('"instruction" and "conclusion" in English')
    const prompt = buildModeDraftPrompt({ description: 'A pre-mortem.', languageNamed: 'Italian', existingNames: ['Free', 'Decision'] })
    expect(prompt).toContain('A pre-mortem.')
    expect(prompt).toContain('Do not reuse these names: Free, Decision.')
  })
})

describe('parseModeDraft', () => {
  const answer = { name: 'Pre-mortem', emoji: '🔎', instruction: 'On every turn, assume   the project failed.', conclusion: 'List the likely causes.' }

  it('reads a clean object and collapses whitespace', () => {
    expect(parseModeDraft(JSON.stringify(answer))).toEqual({ ...answer, instruction: 'On every turn, assume the project failed.' })
  })

  it('reads an object wrapped in fences and prose', () => {
    expect(parseModeDraft(`Here it is:\n\`\`\`json\n${JSON.stringify(answer)}\n\`\`\``)?.name).toBe('Pre-mortem')
  })

  it('keeps an emoji outside the picker and drops text that is not one', () => {
    expect(parseModeDraft(JSON.stringify({ ...answer, emoji: '🦊' })).emoji).toBe('🦊')
    expect(parseModeDraft(JSON.stringify({ ...answer, emoji: 'fox' })).emoji).toBe('')
  })

  it('rejects an answer with no purpose or no object', () => {
    expect(parseModeDraft(JSON.stringify({ ...answer, instruction: '  ' }))).toBeNull()
    expect(parseModeDraft('not json')).toBeNull()
    expect(parseModeDraft('{broken')).toBeNull()
    expect(parseModeDraft('')).toBeNull()
  })

  it('bounds the name length', () => {
    expect(parseModeDraft(JSON.stringify({ ...answer, name: 'x'.repeat(200) })).name).toHaveLength(40)
  })
})
