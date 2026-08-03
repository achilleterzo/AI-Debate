import { describe, expect, it } from 'vitest'
import { Debate } from '../src/debate/Debate'
import { CONCLUSION_TYPES } from '../src/prompts/ConclusionTypes'

describe('mode-aware conclusions', () => {
  it('carries the selected debate mode into the conclusion context', () => {
    const context = Debate.buildConclusionContext({
      conversation: 'The party enters the ruined tower.',
      debateMode: 'role_play',
      type: 'summary',
      model: 'test-model',
    })

    expect(context.debate_mode).toBe('role_play')
    expect(context.debate_mode_label).toBe('Role Play')
    expect(context.debate_mode_conclusion_instruction).toContain('Stay inside the fiction')
  })

  it('adds mode-specific guidance to the conclusion prompt', () => {
    const context = Debate.buildConclusionContext({
      conversation: 'The group compared three options.',
      debateMode: 'decision',
      type: 'verdict',
      model: 'test-model',
    })
    const prompt = Debate.buildConclusionPrompt({
      conclusionType: CONCLUSION_TYPES.find(type => type.id === 'verdict'),
      context,
    })

    expect(prompt).toContain('Shared debate mode (HIGH PRIORITY): Decision')
    expect(prompt).toContain('Compare the options against explicit criteria')
  })
})
