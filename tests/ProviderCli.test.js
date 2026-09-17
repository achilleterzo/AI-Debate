import { afterEach, describe, expect, it, vi } from 'vitest'
import { claudeProvider } from '../src/providers/claude.js'
import { openaiProvider } from '../src/providers/openai.js'
import { getProvider, setActiveProviderId } from '../src/providers/index.js'

afterEach(() => {
  vi.unstubAllGlobals()
  setActiveProviderId('ollama')
})

describe('desktop CLI providers', () => {
  it('registers OpenAI and Claude as selectable providers', () => {
    setActiveProviderId('openai')
    expect(getProvider()).toBe(openaiProvider)
    setActiveProviderId('claude')
    expect(getProvider()).toBe(claudeProvider)
  })

  it('discovers models and normalizes a CLI answer into the stream protocol', async () => {
    const desktop = {
      aiListModels: vi.fn().mockResolvedValue(['gpt-test']),
      aiChat: vi.fn().mockResolvedValue('Hello from the CLI'),
      aiCancel: vi.fn(),
    }
    vi.stubGlobal('window', { desktop })

    expect(await openaiProvider.listModels()).toEqual(['gpt-test'])
    const request = openaiProvider.buildChatRequest({ model: 'gpt-test', messages: [{ role: 'user', content: 'Hello' }] })
    const response = await openaiProvider.sendChat(request)
    const parser = openaiProvider.createStreamParser()
    const events = parser.push(await response.text())

    expect(events).toEqual([
      { type: 'delta', text: 'Hello from the CLI' },
      { type: 'done', content: 'Hello from the CLI', doneReason: null },
    ])
    expect(desktop.aiChat).toHaveBeenCalledWith(expect.objectContaining({ provider: 'openai', model: 'gpt-test', requestId: expect.any(String) }))
  })

  it('reports native providers as unavailable in a browser build', async () => {
    vi.stubGlobal('window', {})
    await expect(claudeProvider.listModels()).rejects.toThrow('desktop app')
    await expect(claudeProvider.health()).resolves.toBe(false)
  })

  it('propagates the CLI authentication error instead of returning an empty response', async () => {
    vi.stubGlobal('window', {
      desktop: {
        aiChat: vi.fn().mockRejectedValue(new Error('Failed to authenticate: OAuth session expired')),
        aiCancel: vi.fn(),
      },
    })
    const request = claudeProvider.buildChatRequest({ model: 'sonnet', messages: [{ role: 'user', content: 'Hello' }] })
    await expect(claudeProvider.sendChat(request)).rejects.toThrow('OAuth session expired')
  })
})
