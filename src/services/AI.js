import { useCallback, useEffect } from 'react'
import { getProvider } from '../providers/index.js'

export class AI {
  static async fetchModels(baseUrl, { providerId } = {}) {
    return getProvider(providerId).listModels(baseUrl)
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
