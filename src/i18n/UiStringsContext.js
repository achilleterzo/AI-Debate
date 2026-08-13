import { createContext, useContext } from 'react'
import { UI_STRINGS as BASE_UI_STRINGS } from './UiStrings'

/**
 * The context and its hook, kept apart from the provider that fills it.
 *
 * Fast Refresh only treats a module as a boundary when everything it exports
 * is a component, and this is the module the whole UI imports `useUiStrings`
 * from. Housing the provider here too made every edit to a locale file
 * invalidate past it and reload the page instead of refreshing the strings in
 * place — see UiStringsProvider.jsx.
 */
export const UiStringsContext = createContext(BASE_UI_STRINGS)

export function useUiStrings() {
  return useContext(UiStringsContext)
}
