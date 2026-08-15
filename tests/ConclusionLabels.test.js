import { describe, expect, it } from 'vitest'
import { CONCLUSION_TYPES, conclusionTypeLabel } from '../src/prompts/ConclusionTypes'
import { UI_STRINGS } from '../src/i18n/UiStrings'
import { LOCALES } from '../src/i18n/locales'

const merge = lang => ({ ...UI_STRINGS, conclusionTypes: { ...UI_STRINGS.conclusionTypes, ...LOCALES[lang]?.conclusionTypes } })

describe('conclusion type labels', () => {
  it('names every type in the interface language', () => {
    // The row of buttons stayed English in every translation because the
    // definitions carried their own label and nothing looked the locale up.
    const italian = CONCLUSION_TYPES.map(type => conclusionTypeLabel(merge('it'), type))

    expect(italian).toEqual(['Sintesi', 'Considerazioni', 'Contraddizioni', 'Punti ciechi', 'Verdetto', 'Prossimi passi', 'Prompt'])
  })

  it('is translated in every locale that ships translations', () => {
    for (const [lang, locale] of Object.entries(LOCALES)) {
      const strings = merge(lang)
      for (const type of CONCLUSION_TYPES) {
        expect(locale.conclusionTypes?.[type.id], `${lang}.${type.id}`).toBeTypeOf('string')
        expect(conclusionTypeLabel(strings, type)).toBe(locale.conclusionTypes[type.id])
      }
    }
  })

  it('accepts a bare id, which is all a stored conclusion carries', () => {
    expect(conclusionTypeLabel(merge('it'), 'verdict')).toBe('Verdetto')
    expect(conclusionTypeLabel(merge('fr'), 'blindspot')).toBe('Angles morts')
  })

  it('falls back to the English name rather than showing an id', () => {
    expect(conclusionTypeLabel({}, CONCLUSION_TYPES[0])).toBe('Summary')
    expect(conclusionTypeLabel(undefined, 'next_steps')).toBe('Next steps')
  })

  it('keeps an English name for the model, which reads the request in English', () => {
    // `labelEn` is what the system prompt names: "respond only with the
    // requested verdict". It is not what the button shows.
    expect(CONCLUSION_TYPES.every(type => typeof type.labelEn === 'string')).toBe(true)
    expect(CONCLUSION_TYPES.find(type => type.id === 'custom').labelEn).toBe('Custom prompt')
    expect(conclusionTypeLabel(merge('it'), 'custom')).toBe('Prompt')
  })
})
