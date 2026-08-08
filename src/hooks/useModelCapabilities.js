import { useEffect, useMemo, useState } from 'react'
import { Debate } from '../debate/Debate'
import { getProvider } from '../providers/index.js'

/**
 * What each participant's model can do, as the endpoint reports it.
 *
 * The settings panel offers controls that only some models accept — asking a
 * model without the capability to think is an HTTP 400 and a lost turn — so
 * the control has to know before the user reaches for it. Answers are cached
 * inside the provider, and listing the models for the picker has usually
 * filled that cache already, so this normally resolves without a request.
 *
 * An endpoint that cannot answer leaves the entry `null`: unknown, not
 * unsupported. A control shown for a model we could not ask stays enabled.
 */
export function useModelCapabilities(participants = [], baseUrl = '') {
  const [known, setKnown] = useState({})

  const targets = useMemo(() => {
    const seen = new Map()
    for (const participant of participants) {
      if (participant?.localUser || participant?.model === Debate.USER_MODEL) continue
      const model = String(participant?.model || '').trim()
      if (!model) continue
      const endpoint = (participant.endpointOverride?.trim() || baseUrl || '').replace(/\/$/, '')
      if (!endpoint) continue
      const key = `${endpoint} ${model}`
      if (!seen.has(key)) seen.set(key, { key, endpoint, model })
    }
    return [...seen.values()]
  }, [participants, baseUrl])

  const signature = useMemo(() => targets.map(target => target.key).join('::'), [targets])

  useEffect(() => {
    let cancelled = false
    if (targets.length === 0) return

    ;(async () => {
      const provider = getProvider()
      const resolved = await Promise.all(targets.map(async target => [
        target.key,
        await provider.capabilities(target.endpoint, target.model),
      ]))
      if (!cancelled) {
        setKnown(previous => ({ ...previous, ...Object.fromEntries(resolved) }))
      }
    })()

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  return useMemo(() => {
    const byParticipant = {}
    for (const participant of participants) {
      const model = String(participant?.model || '').trim()
      const endpoint = (participant?.endpointOverride?.trim() || baseUrl || '').replace(/\/$/, '')
      const capabilities = known[`${endpoint} ${model}`]
      byParticipant[participant.id] = {
        capabilities: capabilities ?? null,
        // `null` is "not answered yet", which must not read as "unsupported".
        thinking: capabilities ? capabilities.includes('thinking') : null,
        tools: capabilities ? capabilities.includes('tools') : null,
      }
    }
    return byParticipant
  }, [participants, baseUrl, known])
}
