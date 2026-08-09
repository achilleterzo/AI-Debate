import { useCallback, useState } from 'react'
import { Storage } from '../data/Storage'

/**
 * Welcome screen visibility plus the "show at startup" preference.
 *
 * Visibility is seeded from the stored preference only on the first render, so
 * unticking the box inside the splash saves the choice for the next launch
 * without closing the screen the user is still reading.
 *
 * `suppressed` is what a restored conversation sets: the welcome screen asks
 * what the user wants to start, and someone coming back to a chat already
 * answered that. The stored preference is left untouched — the next launch with
 * no chat to return to shows the splash again.
 */
export function useSplashScreen({ suppressed = false } = {}) {
  const [showOnStartup, setShowOnStartup] = useState(Storage.loadShowSplashOnStartup)
  const [visible, setVisible] = useState(showOnStartup && !suppressed)

  const changeShowOnStartup = useCallback(next => {
    setShowOnStartup(next)
    Storage.saveShowSplashOnStartup(next)
  }, [])

  const open = useCallback(() => setVisible(true), [])
  const close = useCallback(() => setVisible(false), [])

  return { visible, open, close, showOnStartup, setShowOnStartup: changeShowOnStartup }
}
