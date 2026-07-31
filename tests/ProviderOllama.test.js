import { describe, expect, it, vi, afterEach } from 'vitest'
import { ollamaProvider } from '../src/providers/ollama'
import { getProvider, DEFAULT_PROVIDER_ID } from '../src/providers/index'

afterEach(() => {
  vi.unstubAllGlobals()
})

const line = obj => JSON.stringify(obj) + '\n'

describe('provider registry', () => {
  it('resolves ollama by default and falls back for unknown ids', () => {
    expect(getProvider().id).toBe('ollama')
    expect(DEFAULT_PROVIDER_ID).toBe('ollama')
    expect(getProvider('does-not-exist').id).toBe('ollama')
  })
})

describe('ollamaProvider.supportsTools', () => {
  it('keeps the existing model exclusions', () => {
    expect(ollamaProvider.supportsTools('llama3.1:8b')).toBe(true)
    expect(ollamaProvider.supportsTools('deepseek-r1:14b')).toBe(false)
    expect(ollamaProvider.supportsTools('MiniMax-Text')).toBe(false)
    expect(ollamaProvider.supportsTools('')).toBe(true)
    expect(ollamaProvider.supportsTools(undefined)).toBe(true)
  })
})

describe('ollamaProvider.buildChatRequest', () => {
  it('targets /api/chat and always streams', () => {
    const req = ollamaProvider.buildChatRequest({
      baseUrl: 'http://localhost:11434',
      model: 'm',
      messages: [{ role: 'user', content: 'hi' }],
    })
    expect(req.url).toBe('http://localhost:11434/api/chat')
    expect(req.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(req.body).toMatchObject({ model: 'm', stream: true })
    expect(req.body).not.toHaveProperty('tools')
  })

  it('includes tools only when provided', () => {
    const tools = [{ type: 'function', function: { name: 'web_search' } }]
    const req = ollamaProvider.buildChatRequest({ baseUrl: 'http://x', model: 'm', messages: [], tools })
    expect(req.body.tools).toEqual(tools)
  })
})

describe('ollamaProvider.createStreamParser', () => {
  it('emits deltas, tool calls and done in order', () => {
    const parser = ollamaProvider.createStreamParser()
    const events = [
      ...parser.push(line({ message: { content: 'Hel' } })),
      ...parser.push(line({ message: { content: 'lo' } })),
      ...parser.push(line({ message: { content: '', tool_calls: [{ function: { name: 'web_search' } }] } })),
      ...parser.push(line({ done: true, message: { content: '' } })),
    ]

    expect(events.map(e => e.type)).toEqual(['delta', 'delta', 'toolCalls', 'done'])
    expect(events[0].text).toBe('Hel')
    expect(events[2].toolCalls).toHaveLength(1)
  })

  it('reassembles a JSON object split across two chunks', () => {
    const parser = ollamaProvider.createStreamParser()
    const payload = line({ message: { content: 'split-safe' } })
    const cut = Math.floor(payload.length / 2)

    expect(parser.push(payload.slice(0, cut))).toEqual([])
    const events = parser.push(payload.slice(cut))

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ type: 'delta', text: 'split-safe' })
  })

  it('drains a trailing line without a newline on flush', () => {
    const parser = ollamaProvider.createStreamParser()
    expect(parser.push(JSON.stringify({ message: { content: 'tail' } }))).toEqual([])
    expect(parser.flush()).toEqual([{ type: 'delta', text: 'tail' }])
  })

  it('reports a provider error and skips the rest of that line', () => {
    const parser = ollamaProvider.createStreamParser()
    const events = parser.push(line({ error: 'model not found', message: { content: 'ignored' } }))
    expect(events).toEqual([{ type: 'error', message: 'model not found' }])
  })

  it('flags unparsable lines instead of throwing', () => {
    const parser = ollamaProvider.createStreamParser()
    const events = parser.push('{ not json }\n')
    expect(events).toEqual([{ type: 'malformed', line: '{ not json }' }])
  })

  it('ignores blank lines', () => {
    const parser = ollamaProvider.createStreamParser()
    expect(parser.push('\n\n  \n')).toEqual([])
    expect(parser.flush()).toEqual([])
  })
})

describe('ollamaProvider.listModels', () => {
  it('maps the tags payload to plain names', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ models: [{ name: 'a' }, { name: 'b' }] }),
    })))
    await expect(ollamaProvider.listModels('http://x')).resolves.toEqual(['a', 'b'])
  })

  it('returns an empty list when the payload has no models', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) })))
    await expect(ollamaProvider.listModels('http://x')).resolves.toEqual([])
  })

  it('throws on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })))
    await expect(ollamaProvider.listModels('http://x')).rejects.toThrow('HTTP 500')
  })
})

describe('ollamaProvider.health', () => {
  it('is true only for a reachable, ok endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true })))
    await expect(ollamaProvider.health('http://x')).resolves.toBe(true)
  })

  it('is false for an error status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })))
    await expect(ollamaProvider.health('http://x')).resolves.toBe(false)
  })

  it('swallows network failures rather than throwing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    await expect(ollamaProvider.health('http://x')).resolves.toBe(false)
  })
})
