/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo } from 'react'
import { UI_STRINGS as BASE_UI_STRINGS } from './UiStrings'
import { LOCALES } from './locales'

function mergeUiStrings(base, overrides) {
  if (!overrides) return base
  const merged = {}
  for (const namespace of Object.keys(base)) {
    merged[namespace] = { ...base[namespace], ...(overrides[namespace] ?? {}) }
  }
  return merged
}

const UiStringsContext = createContext(BASE_UI_STRINGS)

export function UiStringsProvider({ lang, children }) {
  const value = useMemo(() => mergeUiStrings(BASE_UI_STRINGS, LOCALES[lang]), [lang])
  return <UiStringsContext.Provider value={value}>{children}</UiStringsContext.Provider>
}

export function useUiStrings() {
  return useContext(UiStringsContext)
}
