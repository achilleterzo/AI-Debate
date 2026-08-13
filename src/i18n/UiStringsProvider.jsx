import { useMemo } from 'react'
import { UI_STRINGS as BASE_UI_STRINGS } from './UiStrings'
import { UiStringsContext } from './UiStringsContext'
import { LOCALES } from './locales'

/**
 * A locale only has to carry the strings it actually translates: anything it
 * leaves out falls back to the English base, namespace by namespace.
 */
function mergeUiStrings(base, overrides) {
  if (!overrides) return base
  const merged = {}
  for (const namespace of Object.keys(base)) {
    merged[namespace] = { ...base[namespace], ...(overrides[namespace] ?? {}) }
  }
  return merged
}

export function UiStringsProvider({ lang, children }) {
  const value = useMemo(() => mergeUiStrings(BASE_UI_STRINGS, LOCALES[lang]), [lang])
  return <UiStringsContext.Provider value={value}>{children}</UiStringsContext.Provider>
}
