import { useCallback, useEffect, useRef } from 'react'
import { getProvider } from '../providers/index.js'
import { normalizeDisabledModels } from '../settings/Settings'

export class AI {
  static async fetchModels(baseUrl, { providerId } = {}) {
    return getProvider(providerId).listModels(baseUrl)
  }

  /**
   * The retrieved list minus what the Ollama tab switched off. Everything that
   * offers a model runs off the result, so a disabled model is not merely
   * hidden in one place — the app never learns it exists.
   */
  static keepEnabledModels(models, disabledModels = []) {
    if (!Array.isArray(models)) return []
    const disabled = new Set(normalizeDisabledModels(disabledModels))
    return disabled.size === 0 ? models : models.filter(model => !disabled.has(model))
  }

  /** The order the Ollama tab lists models in: cloud first, each group A–Z. */
  static orderModels(models, { defaultModel = '' } = {}) {
    if (!Array.isArray(models)) return []
    return [...models].sort((left, right) => {
      const defaultDifference = Number(right === defaultModel) - Number(left === defaultModel)
      if (defaultDifference) return defaultDifference
      return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' })
    })
  }

  /**
   * Where the general default lands when the model holding it is switched off.
   * List order, so the pick is the first row still enabled — the one the user
   * is looking at — rather than an arbitrary survivor.
   */
  static firstEnabledModel(models, disabledModels = []) {
    return AI.orderModels(AI.keepEnabledModels(models, disabledModels))[0] ?? ''
  }

  /** Empty participant model means "use the general default". */
  static assignMissingParticipantModels(participants) {
    return participants
  }
}

export function useAIModels({
  providerId,
  providerAuth = '',
  baseUrl,
  noLocalModelsMessage,
  setConnecting,
  setConnectError,
  setModels,
  setBaseUrl,
  setOllamaOk,
}) {
  /**
   * Resolves to the model list once it is on screen, or to null if the endpoint
   * did not answer. `setModels` is told which provider the list belongs to:
   * the answer can arrive after the user switched to another one.
   */
  const activeProviderRef = useRef(providerId)
  useEffect(() => { activeProviderRef.current = providerId }, [providerId])
  const fetchModels = useCallback(async (url, selectedProvider = providerId) => {
    setConnecting(true)
    setConnectError(null)
    // The connection status describes the active provider. A late answer from
    // the one the user just left still fills its own list, and nothing else.
    const stillActive = () => activeProviderRef.current === selectedProvider
    try {
      const list = await AI.fetchModels(url, { providerId: selectedProvider })
      setModels(AI.orderModels(list), selectedProvider)
      if (stillActive()) {
        // Only an Ollama listing says anything about the Ollama endpoint. The
        // other providers ignore the address, and adopting it from their
        // answer is what reset a custom endpoint to the default.
        if (selectedProvider === 'ollama') setBaseUrl(url)
        setOllamaOk(true)
        setConnectError(list.length === 0 ? noLocalModelsMessage : null)
      }
      return list
    } catch (err) {
      setModels([], selectedProvider)
      if (stillActive()) {
        setOllamaOk(false)
        setConnectError(err.message)
      }
      return null
    } finally {
      setConnecting(false)
    }
  }, [noLocalModelsMessage, providerId, setBaseUrl, setConnectError, setConnecting, setModels, setOllamaOk])

  // The saved endpoint, read when the provider is (re)opened. A ref rather than
  // a dependency: connecting to a new address already lists its models, and
  // adopting that address must not trigger a second listing.
  const baseUrlRef = useRef(baseUrl)
  useEffect(() => { baseUrlRef.current = baseUrl }, [baseUrl])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchModels(baseUrlRef.current, providerId)
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [fetchModels, providerAuth, providerId])

  return { fetchModels }
}
