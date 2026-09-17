import { describe, expect, it } from 'vitest'
import { AI } from '../src/services/AI'

const models = ['alpha:latest', 'beta:latest']

describe('AI.keepEnabledModels', () => {
  it('returns the list untouched when nothing is disabled', () => {
    expect(AI.keepEnabledModels(models)).toBe(models)
    expect(AI.keepEnabledModels(models, [])).toBe(models)
  })

  it('drops every disabled name', () => {
    expect(AI.keepEnabledModels(models, ['alpha:latest'])).toEqual(['beta:latest'])
    expect(AI.keepEnabledModels(models, ['alpha:latest', 'beta:latest'])).toEqual([])
  })

  it('ignores disabled names the endpoint does not serve', () => {
    expect(AI.keepEnabledModels(models, ['gone:latest'])).toEqual(models)
  })

  it('survives a malformed disabled list', () => {
    expect(AI.keepEnabledModels(models, null)).toEqual(models)
    expect(AI.keepEnabledModels(models, [' alpha:latest ', '', null])).toEqual(['beta:latest'])
    expect(AI.keepEnabledModels(null, ['alpha:latest'])).toEqual([])
  })
})

describe('AI.firstEnabledModel', () => {
  const catalogue = ['zeta:latest', 'alpha:latest', 'beta-cloud', 'alpha-cloud']

  it('sorts the catalogue alphabetically and can pin the selected default first', () => {
    expect(AI.orderModels(catalogue)).toEqual(['alpha-cloud', 'alpha:latest', 'beta-cloud', 'zeta:latest'])
    expect(AI.orderModels(catalogue, { defaultModel: 'zeta:latest' })).toEqual(['zeta:latest', 'alpha-cloud', 'alpha:latest', 'beta-cloud'])
    expect(AI.firstEnabledModel(catalogue)).toBe('alpha-cloud')
  })

  it('skips whatever is disabled', () => {
    expect(AI.firstEnabledModel(catalogue, ['alpha-cloud'])).toBe('alpha:latest')
    expect(AI.firstEnabledModel(catalogue, ['alpha-cloud', 'beta-cloud'])).toBe('alpha:latest')
  })

  it('has nothing to fall back to once every model is disabled', () => {
    expect(AI.firstEnabledModel(catalogue, catalogue)).toBe('')
    expect(AI.firstEnabledModel([])).toBe('')
  })
})

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
