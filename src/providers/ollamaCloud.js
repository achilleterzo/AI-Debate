import { ollamaProvider } from './ollama.js'

export const OLLAMA_CLOUD_URL = 'https://ollama.com'
let transientApiKey = ''
let hasStoredKey = false
const capabilitiesByModel = new Map()

export function configureOllamaCloud({ apiKey: value = '', stored = false } = {}) {
  transientApiKey = String(value || '').trim()
  hasStoredKey = Boolean(stored)
}

function desktopApi() {
  return typeof window !== 'undefined' ? window.desktop : null
}

async function cloudRequest(path, { method = 'GET', body = null, requestId = '' } = {}) {
  if (!transientApiKey && !hasStoredKey) throw new Error('Ollama Cloud API key required')
  const api = desktopApi()
  if (!api?.ollamaCloudRequest) throw new Error('Ollama Cloud direct access is available only in the desktop app')
  const response = await api.ollamaCloudRequest({ path, method, body, apiKey: transientApiKey, requestId })
  if (response.status < 200 || response.status >= 300) {
    let message = response.body
    try { message = JSON.parse(response.body)?.error || message } catch { /* keep response text */ }
    throw new Error(`HTTP ${response.status}${message ? `: ${String(message).slice(0, 200)}` : ''}`)
  }
  return response.body
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
    if (!transientApiKey && !hasStoredKey) return false
    try { await cloudRequest('/api/tags'); return true } catch { return false }
  },
  buildChatRequest(options) {
    const request = ollamaProvider.buildChatRequest({ ...options, baseUrl: OLLAMA_CLOUD_URL })
    return { ...request, headers: { 'Content-Type': 'application/json' } }
  },
  async sendChat(request, { signal } = {}) {
    if (signal?.aborted) throw new DOMException('The operation was aborted', 'AbortError')
    const api = desktopApi()
    if (!api?.ollamaCloudStream) throw new Error('Ollama Cloud direct access is available only in the desktop app')
    if (!transientApiKey && !hasStoredKey) throw new Error('Ollama Cloud API key required')
    const requestId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
    const abort = () => { void desktopApi()?.ollamaCloudCancel?.(requestId) }
    signal?.addEventListener('abort', abort, { once: true })
    return new Promise((resolve, reject) => {
      let started = false
      let controller
      const stream = new ReadableStream({ start(value) { controller = value } })
      const cleanup = () => {
        signal?.removeEventListener('abort', abort)
        api.ollamaCloudStreamCleanup?.(requestId)
      }
      api.ollamaCloudStream({ path: '/api/chat', method: 'POST', body: request.body, apiKey: transientApiKey, requestId }, event => {
        if (event.type === 'start') {
          started = true
          resolve(new Response(stream, { status: event.status, headers: { 'Content-Type': 'application/x-ndjson' } }))
        } else if (event.type === 'chunk') {
          controller.enqueue(new TextEncoder().encode(event.chunk))
        } else if (event.type === 'end') {
          controller.close()
          cleanup()
        } else if (event.type === 'error') {
          const error = signal?.aborted ? new DOMException('The operation was aborted', 'AbortError') : new Error(event.message)
          if (started) controller.error(error)
          else reject(error)
          cleanup()
        }
      })
    })
  },
}
