import { useCallback, useEffect } from 'react'

export class AI {
  static async fetchModels(baseUrl) {
    const response = await fetch(`${baseUrl}/api/tags`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    return data.models?.map(model => model.name) ?? []
  }

  static assignMissingParticipantModels(participants, models) {
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
}) {
  const fetchModels = useCallback(async (url) => {
    setConnecting(true)
    setConnectError(null)
    try {
      const list = await AI.fetchModels(url)
      setModels(list)
      setParticipants(prev => AI.assignMissingParticipantModels(prev, list))
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
