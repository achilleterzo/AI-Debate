import { describe, expect, it } from 'vitest'
import { PROMPT_SECTION_TAGS, stripPromptScaffolding } from '../src/prompts/PromptTags'
import { buildSystemPrompt } from '../src/debate/PromptBuilder'
import { Debate } from '../src/debate/Debate'

describe('stripPromptScaffolding', () => {
  it('removes a whole block, monologue included', () => {
    const answer = stripPromptScaffolding(
      '<reasoning_focus>\nLet me review what is happening. I should check memory first.\n</reasoning_focus>Ecco la mia posizione.',
    )
    expect(answer.trim()).toBe('Ecco la mia posizione.')
  })

  it('empties an answer that was nothing but scaffolding', () => {
    expect(stripPromptScaffolding('<conversation_context></conversation_context>').trim()).toBe('')
    expect(stripPromptScaffolding('<conversation_context>\nMarco Riva said: ...\n</conversation_context>').trim()).toBe('')
  })

  it('removes stray opening and closing tags', () => {
    expect(stripPromptScaffolding('Testo valido.\n</conversation_context>').trim()).toBe('Testo valido.')
    expect(stripPromptScaffolding('<fetched_sources>\nTesto valido.').trim()).toBe('Testo valido.')
  })

  it('keeps several blocks from swallowing the text between them', () => {
    const answer = stripPromptScaffolding('<identity>x</identity>Prima.<constraints>y</constraints>Dopo.')
    expect(answer).toBe('Prima.Dopo.')
  })

  it('leaves ordinary prose and markup alone', () => {
    const prose = 'Il sito usa `<div>` e <strong>grassetto</strong>, con 3 < 5 come esempio.'
    expect(stripPromptScaffolding(prose)).toBe(prose)
  })
})

describe('the tag list stays in step with the prompt', () => {
  it('lists every tag a built system prompt actually emits', () => {
    const parts = [
      { ...Debate.mkParticipant(0, 'm'), name: 'Alice', thinkingLevel: 'high' },
      { ...Debate.mkParticipant(1, 'm'), name: 'Mod', isModerator: true },
    ]
    const prompt = buildSystemPrompt({
      actor: { ...parts[0], characterType: 'historical', constraints: [{ text: 'Una regola', override: true }] },
      allParticipants: parts,
      history: [{ role: 'topic', content: 'Un argomento' }],
      uiLang: 'it',
      attachedDocs: [{ name: 'doc.md', content: 'contenuto' }],
      globalConstraints: ['Regola globale'],
      characterContext: 'Profilo',
      externalModerationTrigger: { needed: true, reason: 'test' },
      constants: Debate.buildPromptConstants(),
    })

    const emitted = [...new Set([...prompt.matchAll(/<([a-z_]+)>/g)].map(match => match[1]))]
    expect(emitted.length).toBeGreaterThan(5)
    for (const tag of emitted) {
      expect(PROMPT_SECTION_TAGS, `<${tag}> is emitted but not stripped`).toContain(tag)
    }
  })
})
