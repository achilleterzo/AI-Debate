/**
 * The search engines the app knows about, as plain data.
 *
 * Lives under electron/ because only that folder ships in the desktop package,
 * but it imports nothing from Electron: the renderer bundles it too, so the
 * settings list, the tool schema, the result labels and the Auto order can
 * never disagree with what the main process actually implements.
 *
 * - `auto`: position in the Auto chain, 0 = never tried silently.
 * - `desktopOnly`: needs the Electron browser; the web build cannot reach it.
 */
export const SEARCH_ENGINES = [
  { id: 'duckduckgo', label: 'DuckDuckGo', auto: 3, desktopOnly: false },
  { id: 'brave', label: 'Brave', auto: 1, desktopOnly: true },
  { id: 'bing', label: 'Bing', auto: 2, desktopOnly: true },
  // Consent pages and bot challenges make Google a poor silent fallback.
  { id: 'google', label: 'Google', auto: 0, desktopOnly: true, experimental: true },
]

export const AUTO_SEARCH_ENGINE = 'auto'

export const SEARCH_ENGINE_IDS = [AUTO_SEARCH_ENGINE, ...SEARCH_ENGINES.map(engine => engine.id)]

export const AUTO_ENGINE_ORDER = SEARCH_ENGINES
  .filter(engine => engine.auto > 0)
  .sort((a, b) => a.auto - b.auto)
  .map(engine => engine.id)

export function searchEngineInfo(id) {
  return SEARCH_ENGINES.find(engine => engine.id === id) ?? null
}

export function searchEngineLabel(id) {
  if (id === AUTO_SEARCH_ENGINE) return 'Auto'
  return searchEngineInfo(id)?.label ?? String(id ?? '')
}

/** Whether `id` can run where the Electron browser is (or is not) available. */
export function searchEngineAvailable(id, { desktop }) {
  if (id === AUTO_SEARCH_ENGINE) return true
  const info = searchEngineInfo(id)
  return !!info && (desktop || !info.desktopOnly)
}
