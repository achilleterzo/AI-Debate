import { describe, expect, it } from 'vitest'
import { AI } from '../src/services/AI'

const models = ['alpha:latest', 'beta:latest']

describe('AI.assignMissingParticipantModels', () => {
  it('leaves empty models untouched so they use the general default', () => {
    const participants = [{ id: 0, model: '' }, { id: 1, model: '' }]
    expect(AI.assignMissingParticipantModels(participants, models).map(p => p.model))
      .toEqual(['', ''])
  })

  it('does not assign a model even when models are available', () => {
    const participants = [{ id: 0, model: '' }, { id: 1, model: '' }, { id: 2, model: '' }]
    expect(AI.assignMissingParticipantModels(participants, ['only:latest']).map(p => p.model))
      .toEqual(['', '', ''])
  })

  it('never touches participants that already chose a model', () => {
    const participants = [{ id: 0, model: 'kept:latest' }, { id: 1, model: '' }]
    expect(AI.assignMissingParticipantModels(participants, models).map(p => p.model))
      .toEqual(['kept:latest', ''])
  })

  it('preserves the participant objects unchanged', () => {
    const participants = [{ id: 0, model: '' }, { id: 1, model: 'kept:latest' }]
    const result = AI.assignMissingParticipantModels(participants, models, { defaultModel: 'default:latest' })

    expect(result.map(p => p.model)).toEqual(['', 'kept:latest'])
    expect(result).toBe(participants)
  })

  it('keeps the empty model when no general default is configured', () => {
    const participants = [{ id: 0, model: '' }]
    expect(AI.assignMissingParticipantModels(participants, models, { defaultModel: '' })[0].model)
      .toBe('')
  })
})
