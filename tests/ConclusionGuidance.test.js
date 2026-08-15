import { describe, expect, it } from 'vitest'
import { Debate } from '../src/debate/Debate'
import { CONCLUSION_TYPES, normalizeStandardConclusionPrompts, standardConclusionTypeIds } from '../src/prompts/ConclusionTypes'

describe('per-type conclusion guidance', () => {
  it('covers every conclusion type except the custom prompt, which has its own field', () => {
    const ids = standardConclusionTypeIds()
    expect(ids).toEqual(CONCLUSION_TYPES.filter(type => type.id !== 'custom').map(type => type.id))
    expect(ids).not.toContain('custom')
  })

  it('keeps each type separate', () => {
    const prompts = normalizeStandardConclusionPrompts({ summary: 'stay factual', verdict: 'name a winner' })

    expect(prompts.summary).toBe('stay factual')
    expect(prompts.verdict).toBe('name a winner')
    expect(prompts.blindspot).toBe('')
  })

  it('carries a stored single string onto every type', () => {
    // What every version before this saved, applied to whichever type was
    // generated. Dropping it would silently stop sending guidance a user wrote.
    const prompts = normalizeStandardConclusionPrompts('answer in bullet points')

    expect(Object.values(prompts).every(text => text === 'answer in bullet points')).toBe(true)
    expect(Object.keys(prompts)).toEqual(standardConclusionTypeIds())
  })

  it('reads nothing usable as empty guidance rather than failing', () => {
    for (const value of [null, undefined, 42, []]) {
      expect(Object.values(normalizeStandardConclusionPrompts(value)).every(text => text === '')).toBe(true)
    }
  })

  it('sends the selected type its own guidance and nothing else', () => {
    const { prompt } = Debate.buildConclusionRequest({
      history: [{ role: 'p1', content: 'a point' }],
      participants: [{ tag: 'p1', name: 'Ann' }],
      conclusionType: CONCLUSION_TYPES.find(type => type.id === 'blindspot'),
      type: 'blindspot',
      model: 'test-model',
      standardPrompt: normalizeStandardConclusionPrompts({ blindspot: 'look at the funding', summary: 'stay factual' }).blindspot,
    })

    expect(prompt).toContain('look at the funding')
    expect(prompt).not.toContain('stay factual')
  })
})
