import { describe, expect, it } from 'vitest'
import { MOODS } from '../src/prompts/Moods'
import { resolveConstraint } from '../src/prompts/ConstraintsPrompt'

describe('Participant moods', () => {
  it('offers Investigator as an evidence-led individual attitude', () => {
    const investigator = MOODS.find(mood => mood.id === 'investigator')

    expect(investigator).toBeDefined()
    expect(resolveConstraint(investigator, 'investigation')).toContain('gather and connect clues')
    expect(resolveConstraint(investigator, 'free')).toContain('test competing explanations')
    expect(resolveConstraint(investigator, 'free')).toContain('avoid conclusions that go beyond the evidence')
  })
})
