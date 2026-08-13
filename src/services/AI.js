import { useCallback, useEffect } from 'react'
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
  static orderModels(models) {
    if (!Array.isArray(models)) return []
    return [
      ...models.filter(model => model.endsWith('cloud')).sort(),
      ...models.filter(model => !model.endsWith('cloud')).sort(),
    ]
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
  defaultUrl,
  noLocalModelsMessage,
  setConnecting,
  setConnectError,
  setModels,
  setBaseUrl,
  setOllamaOk,
}) {
  /** Resolves to the model list once it is on screen, or to null if the endpoint did not answer. */
  const fetchModels = useCallback(async (url) => {
    setConnecting(true)
    setConnectError(null)
    try {
      const list = await AI.fetchModels(url)
      setModels(list)
      setBaseUrl(url)
      setOllamaOk(true)
      setConnectError(list.length === 0 ? noLocalModelsMessage : null)
      return list
    } catch (err) {
      setOllamaOk(false)
      setModels([])
      setConnectError(err.message)
      return null
    } finally {
      setConnecting(false)
    }
  }, [noLocalModelsMessage, setBaseUrl, setConnectError, setConnecting, setModels, setOllamaOk])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchModels(defaultUrl)
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [defaultUrl, fetchModels])

  return { fetchModels }
}
