import { useCallback, useState } from 'react'
import { Storage } from '../data/Storage'

/**
 * Welcome screen visibility plus the "show at startup" preference.
 *
 * Visibility is seeded from the stored preference only on the first render, so
 * unticking the box inside the splash saves the choice for the next launch
 * without closing the screen the user is still reading.
 */
export function useSplashScreen() {
  const [showOnStartup, setShowOnStartup] = useState(Storage.loadShowSplashOnStartup)
  const [visible, setVisible] = useState(showOnStartup)

  const changeShowOnStartup = useCallback(next => {
    setShowOnStartup(next)
    Storage.saveShowSplashOnStartup(next)
  }, [])

  const open = useCallback(() => setVisible(true), [])
  const close = useCallback(() => setVisible(false), [])

  return { visible, open, close, showOnStartup, setShowOnStartup: changeShowOnStartup }
}
