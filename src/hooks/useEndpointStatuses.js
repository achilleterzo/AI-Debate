import { useEffect, useMemo, useState } from 'react'
import { Debate } from '../debate/Debate'
import { getProvider } from '../providers/index.js'

// Key for the summary endpoint inside the status map. Participant ids are
// numbers, so a string can never collide with one.
export const SUMMARY_ENDPOINT_ID = 'summary'

// Stable identity: a literal default would make the memos below see a new
// array on every render.
const NO_EXTRA_ENDPOINTS = []

/**
 * Reachability of every custom endpoint in play, keyed by participant id plus
 * whatever `extraEndpoints` adds — pass it a memoized `[{ id, url }]` list.
 */
export function useEndpointStatuses(participants, extraEndpoints = NO_EXTRA_ENDPOINTS) {
  const [results, setResults] = useState({})

  const targets = useMemo(() => [
    ...participants
      .filter(participant => !participant.localUser && participant.model !== Debate.USER_MODEL && participant.endpointOverride?.trim())
      .map(participant => ({ id: participant.id, url: participant.endpointOverride.trim().replace(/\/$/, '') })),
    ...extraEndpoints
      .filter(endpoint => endpoint?.url?.trim())
      .map(endpoint => ({ id: endpoint.id, url: endpoint.url.trim().replace(/\/$/, '') })),
  ], [participants, extraEndpoints])

  const signature = useMemo(() => targets.map(target => `${target.id}|${target.url}`).join('::'), [targets])

  const statuses = useMemo(
    () => Object.fromEntries(targets.map(target => [target.id, results[target.id] ?? { state: 'checking' }])),
    [targets, results],
  )

  useEffect(() => {
    let cancelled = false
    if (targets.length === 0) return

    ;(async () => {
      const next = {}
      await Promise.all(targets.map(async endpoint => {
        if (!/^https?:\/\//i.test(endpoint.url)) {
          next[endpoint.id] = { state: 'err' }
          return
        }
        const reachable = await getProvider().health(endpoint.url)
        next[endpoint.id] = { state: reachable ? 'ok' : 'err' }
      }))
      if (!cancelled) setResults(next)
    })()

    return () => { cancelled = true }
  }, [targets, signature])

  return statuses
}
