import { afterEach, describe, expect, it, vi } from 'vitest'
import { configureOllamaCloud, OLLAMA_CLOUD_URL, ollamaCloudProvider } from '../src/providers/ollamaCloud.js'
import { streamChat } from '../src/debate/Stream.js'

afterEach(() => {
  configureOllamaCloud({ apiKey: '' })
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Ollama Cloud provider', () => {
  it('requires an API key before listing models', async () => {
    await expect(ollamaCloudProvider.listModels()).rejects.toThrow('API key required')
  })

  it('retrieves the cloud catalogue with bearer authentication', async () => {
    configureOllamaCloud({ apiKey: 'secret-key' })
    const ollamaCloudRequest = vi.fn().mockResolvedValue({ status: 200, body: JSON.stringify({ models: [{ name: 'glm-5' }, { name: 'gpt-oss:120b' }] }) })
    vi.stubGlobal('window', { desktop: { ollamaCloudRequest } })

    await expect(ollamaCloudProvider.listModels()).resolves.toEqual(['glm-5', 'gpt-oss:120b'])
    expect(ollamaCloudRequest).toHaveBeenCalledWith({ path: '/api/tags', method: 'GET', body: null, apiKey: 'secret-key', requestId: '' })
  })

  it('targets the hosted chat endpoint and authorizes the request', () => {
    configureOllamaCloud({ apiKey: 'secret-key' })
    const request = ollamaCloudProvider.buildChatRequest({ model: 'glm-5', messages: [{ role: 'user', content: 'Hello' }] })

    expect(request.url).toBe(`${OLLAMA_CLOUD_URL}/api/chat`)
    expect(request.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(request.body.model).toBe('glm-5')
  })

  it('keeps the API key out of debug payloads while streaming through Electron', async () => {
    configureOllamaCloud({ apiKey: 'secret-key' })
    const ollamaCloudStream = vi.fn((request, onEvent) => {
      onEvent({ type: 'start', status: 200 })
      onEvent({ type: 'chunk', chunk: `${JSON.stringify({ message: { thinking: 'Considering' } })}\n` })
      onEvent({ type: 'chunk', chunk: `${JSON.stringify({ message: { content: 'Cloud answer' }, done: true })}\n` })
      onEvent({ type: 'end' })
    })
    vi.stubGlobal('window', { desktop: { ollamaCloudStream, ollamaCloudStreamCleanup: vi.fn(), ollamaCloudCancel: vi.fn() } })
    let debugPayload
    let thinking = ''
    const provider = { ...ollamaCloudProvider, supportsTools: async () => false, supportsThinking: async () => false }

    await streamChat({
      baseUrl: OLLAMA_CLOUD_URL,
      model: 'glm-5',
      messages: [{ role: 'user', content: 'Hello' }],
      provider,
      onToken: () => {},
      onPayload: payload => { debugPayload = payload },
      onThinking: value => { thinking = value },
    })

    expect(ollamaCloudStream).toHaveBeenCalledWith(expect.objectContaining({ path: '/api/chat', apiKey: 'secret-key' }), expect.any(Function))
    expect(debugPayload.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(JSON.stringify(debugPayload)).not.toContain('secret-key')
    expect(thinking).toBe('Considering')
  })
})
