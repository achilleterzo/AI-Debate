import { useCallback, useRef, useState } from 'react'
import { streamChat } from '../debate/Stream'
import { outputLanguagePhrase } from '../prompts/LanguagePrompt'
import { DEBATE_MODES } from '../prompts/Modes'
import { buildModeDraftPrompt, buildModeDraftSystemPrompt, parseModeDraft } from '../services/ModeDraft'

/**
 * Writes a debate mode from a description, on the default model.
 *
 * One request and nothing applied by this hook: it hands the draft back and the
 * caller decides what to do with it, so a malformed answer costs nothing.
 */
export function useModeGenerator({ baseUrl, defaultModel, timeoutSec, ollamaOk = null, interfaceLang = 'en', setLastPromptEstimate, setLastRequest }) {
  const [running, setRunning] = useState(false)
  const [error, setError] = useState(null)
  const inFlightRef = useRef(null)

  const online = ollamaOk === true
  const available = !!defaultModel && online
  const unavailableReason = !online ? 'offline' : !defaultModel ? 'noModel' : null

  const cancel = useCallback(() => {
    inFlightRef.current?.abort()
    inFlightRef.current = null
    setRunning(false)
  }, [])

  const generate = useCallback(async description => {
    if (!defaultModel || !online || !String(description ?? '').trim()) return null
    inFlightRef.current?.abort()
    const controller = new AbortController()
    inFlightRef.current = controller
    setRunning(true)
    setError(null)
    const languageNamed = outputLanguagePhrase(interfaceLang)
    try {
      let raw = ''
      await streamChat({
        baseUrl,
        model: defaultModel,
        systemPrompt: buildModeDraftSystemPrompt({ languageNamed }),
        messages: [{
          role: 'user',
          content: buildModeDraftPrompt({ description, languageNamed, existingNames: DEBATE_MODES.map(mode => mode.label) }),
        }],
        useTools: false,
        think: false,
        purpose: 'mode draft',
        onEstimate: setLastPromptEstimate,
        onPayload: request => setLastRequest?.({ request }),
        onResponse: exchange => setLastRequest?.(exchange),
        onToken: token => { raw = token },
        timeoutMs: timeoutSec * 1000,
      })
      if (controller.signal.aborted) return null
      const draft = parseModeDraft(raw)
      inFlightRef.current = null
      setRunning(false)
      if (!draft) { setError('empty'); return null }
      return draft
    } catch (err) {
      if (controller.signal.aborted) return null
      inFlightRef.current = null
      setRunning(false)
      setError(err.message || 'failed')
      return null
    }
  }, [baseUrl, defaultModel, online, interfaceLang, setLastPromptEstimate, setLastRequest, timeoutSec])

  return { running, error, available, unavailableReason, generate, cancel }
}
