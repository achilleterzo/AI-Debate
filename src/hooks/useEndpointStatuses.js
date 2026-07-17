import { useEffect, useMemo, useState } from 'react'
import { Debate } from '../debate/Debate'

export function useEndpointStatuses(participants) {
  const [results, setResults] = useState({})
  const signature = useMemo(
    () => participants.map(participant => `${participant.id}|${participant.model}|${(participant.endpointOverride ?? '').trim()}`).join('::'),
    [participants],
  )

  const statuses = useMemo(() => {
    const activeIds = participants
      .filter(participant => participant.model !== Debate.USER_MODEL && participant.endpointOverride?.trim())
      .map(participant => participant.id)

    return Object.fromEntries(activeIds.map(id => [id, results[id] ?? { state: 'checking' }]))
  }, [participants, results])

  useEffect(() => {
    let cancelled = false
    const active = participants
      .filter(participant => participant.model !== Debate.USER_MODEL && participant.endpointOverride?.trim())
      .map(participant => ({ id: participant.id, url: participant.endpointOverride.trim().replace(/\/$/, '') }))

    if (active.length === 0) return

    ;(async () => {
      const next = {}
      await Promise.all(active.map(async endpoint => {
        if (!/^https?:\/\//i.test(endpoint.url)) {
          next[endpoint.id] = { state: 'err' }
          return
        }
        try {
          const response = await fetch(`${endpoint.url}/api/tags`, { signal: AbortSignal.timeout(5000) })
          next[endpoint.id] = { state: response.ok ? 'ok' : 'err' }
        } catch {
          next[endpoint.id] = { state: 'err' }
        }
      }))
      if (!cancelled) setResults(next)
    })()

    return () => { cancelled = true }
  }, [participants, signature])

  return statuses
}
