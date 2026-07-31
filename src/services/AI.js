import { useCallback, useEffect, useRef } from 'react'
import { getProvider } from '../providers/index.js'

export class AI {
  static async fetchModels(baseUrl, { providerId } = {}) {
    return getProvider(providerId).listModels(baseUrl)
  }

  /**
   * Fills in participants that have no model yet, as a convenience on a fresh
   * setup. An empty model is an explicit "use the default model" choice, so
   * once a default exists the selection is left alone — otherwise connecting
   * would silently overwrite it with a concrete model.
   */
  static assignMissingParticipantModels(participants, models, { defaultModel = '' } = {}) {
    if (defaultModel) return participants
    return participants.map((participant, index) => (
      participant.model ? participant : { ...participant, model: models[index] ?? models[0] ?? '' }
    ))
  }
}

export function useAIModels({
  defaultUrl,
  noLocalModelsMessage,
  setConnecting,
  setConnectError,
  setModels,
  setParticipants,
  setBaseUrl,
  setOllamaOk,
  defaultModel = '',
}) {
  // Read through a ref so changing the default model does not re-run the
  // effect below and re-fetch the model list on every change.
  const defaultModelRef = useRef(defaultModel)
  useEffect(() => { defaultModelRef.current = defaultModel }, [defaultModel])

  const fetchModels = useCallback(async (url) => {
    setConnecting(true)
    setConnectError(null)
    try {
      const list = await AI.fetchModels(url)
      setModels(list)
      setParticipants(prev => AI.assignMissingParticipantModels(prev, list, { defaultModel: defaultModelRef.current }))
      setBaseUrl(url)
      setOllamaOk(true)
      setConnectError(list.length === 0 ? noLocalModelsMessage : null)
    } catch (err) {
      setOllamaOk(false)
      setModels([])
      setConnectError(err.message)
    } finally {
      setConnecting(false)
    }
  }, [noLocalModelsMessage, setBaseUrl, setConnectError, setConnecting, setModels, setOllamaOk, setParticipants])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchModels(defaultUrl)
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [defaultUrl, fetchModels])

  return { fetchModels }
}
