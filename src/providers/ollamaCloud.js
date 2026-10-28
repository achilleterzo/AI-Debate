import { ollamaProvider } from './ollama.js'
import { hasHostedKey, hostedRequest, hostedStream } from './hosted.js'

export const OLLAMA_CLOUD_URL = 'https://ollama.com'

const capabilitiesByModel = new Map()

async function cloudRequest(path, { method = 'GET', body = null, requestId = '' } = {}) {
  return hostedRequest('ollama-cloud', 'Ollama Cloud', path, { method, body, requestId })
}

export const ollamaCloudProvider = {
  ...ollamaProvider,
  id: 'ollama-cloud',
  label: 'Ollama Cloud',

  async capabilities(_baseUrl, model) {
    if (capabilitiesByModel.has(model)) return capabilitiesByModel.get(model)
    try {
      const data = JSON.parse(await cloudRequest('/api/show', { method: 'POST', body: { model } }))
      const capabilities = Array.isArray(data.capabilities) ? data.capabilities.map(value => String(value).toLowerCase()) : null
      if (capabilities) capabilitiesByModel.set(model, capabilities)
      return capabilities
    } catch {
      return null
    }
  },
  async supportsTools(model) {
    const capabilities = await this.capabilities(OLLAMA_CLOUD_URL, model)
    return capabilities ? capabilities.includes('tools') : true
  },
  async supportsThinking(model) {
    const capabilities = await this.capabilities(OLLAMA_CLOUD_URL, model)
    return capabilities ? capabilities.includes('thinking') : true
  },
  async listModels() {
    const data = JSON.parse(await cloudRequest('/api/tags'))
    return (data.models || []).map(model => model.name || model.model).filter(Boolean)
  },
  async health() {
    if (!hasHostedKey('ollama-cloud')) return false
    try {
      await cloudRequest('/api/tags')
      return true
    } catch {
      return false
    }
  },
  buildChatRequest(options) {
    const request = ollamaProvider.buildChatRequest({ ...options, baseUrl: OLLAMA_CLOUD_URL })
    return { ...request, headers: { 'Content-Type': 'application/json' } }
  },
  async sendChat(request, { signal } = {}) {
    return hostedStream('ollama-cloud', 'Ollama Cloud', { path: '/api/chat', body: request.body }, { signal })
  },
}
