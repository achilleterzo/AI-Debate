import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { UPDATE_STATUS, buildDevUpdateOverride, checkForUpdates } from '../services/Updates'

export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0'

/**
 * Runs one update check when the app starts and exposes a manual re-check.
 *
 * The automatic run is guarded by a ref so React StrictMode's double mount in
 * development does not fire two requests. For that reason unmounting must not
 * abort the in-flight request: StrictMode unmounts once before the second
 * mount, and aborting there would cancel the only check the guard allows,
 * leaving the UI stuck on "checking". Only a newer manual check cancels an
 * older one; results arriving after a real unmount are simply dropped.
 */
export function useUpdateCheck({ auto = true, currentVersion = APP_VERSION } = {}) {
  const [state, setState] = useState({ status: UPDATE_STATUS.IDLE, currentVersion })
  const autoRanRef = useRef(false)
  const inFlightRef = useRef(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  // `?devUpdate` in development pins the "update available" state. It also
  // short-circuits the request, so the banner can be tested where GitHub is
  // unreachable, and so the manual re-check does not undo the forced state.
  const devOverride = useMemo(() => buildDevUpdateOverride(
    typeof window === 'undefined' ? '' : window.location.search,
    { isDev: import.meta.env.DEV, currentVersion },
  ), [currentVersion])

  const check = useCallback(async () => {
    if (devOverride) {
      setState(devOverride)
      return devOverride
    }

    // Supersede a still-running manual check so the latest click wins.
    inFlightRef.current?.abort()
    const controller = new AbortController()
    inFlightRef.current = controller

    setState({ status: UPDATE_STATUS.CHECKING, currentVersion })
    const result = await checkForUpdates({ currentVersion, signal: controller.signal })

    if (controller.signal.aborted) return result
    inFlightRef.current = null
    if (mountedRef.current) setState(result)
    return result
  }, [currentVersion, devOverride])

  useEffect(() => {
    if (!auto || autoRanRef.current) return
    autoRanRef.current = true
    check()
  }, [auto, check])

  return {
    ...state,
    isChecking: state.status === UPDATE_STATUS.CHECKING,
    updateAvailable: state.status === UPDATE_STATUS.AVAILABLE,
    check,
  }
}
