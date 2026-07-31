import { describe, expect, it } from 'vitest'
import { AI } from '../src/services/AI'

const models = ['alpha:latest', 'beta:latest']

describe('AI.assignMissingParticipantModels', () => {
  it('fills empty models on a fresh setup with no default', () => {
    const participants = [{ id: 0, model: '' }, { id: 1, model: '' }]
    expect(AI.assignMissingParticipantModels(participants, models).map(p => p.model))
      .toEqual(['alpha:latest', 'beta:latest'])
  })

  it('falls back to the first model when the list is shorter than the roster', () => {
    const participants = [{ id: 0, model: '' }, { id: 1, model: '' }, { id: 2, model: '' }]
    expect(AI.assignMissingParticipantModels(participants, ['only:latest']).map(p => p.model))
      .toEqual(['only:latest', 'only:latest', 'only:latest'])
  })

  it('never touches participants that already chose a model', () => {
    const participants = [{ id: 0, model: 'kept:latest' }, { id: 1, model: '' }]
    expect(AI.assignMissingParticipantModels(participants, models).map(p => p.model))
      .toEqual(['kept:latest', 'beta:latest'])
  })

  it('preserves an empty model as "use the default" once a default exists', () => {
    // Regression: connecting used to overwrite this explicit choice, so the
    // participant silently lost it on every reload.
    const participants = [{ id: 0, model: '' }, { id: 1, model: 'kept:latest' }]
    const result = AI.assignMissingParticipantModels(participants, models, { defaultModel: 'default:latest' })

    expect(result.map(p => p.model)).toEqual(['', 'kept:latest'])
    expect(result).toBe(participants)
  })

  it('still fills in when the default model is an empty string', () => {
    const participants = [{ id: 0, model: '' }]
    expect(AI.assignMissingParticipantModels(participants, models, { defaultModel: '' })[0].model)
      .toBe('alpha:latest')
  })
})
