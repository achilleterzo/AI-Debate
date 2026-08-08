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
  const show = capabilities => vi.fn(async () => ({ ok: true, json: async () => ({ capabilities }) }))

  it('believes the endpoint over the model name, in both directions', async () => {
    // Two models the old name heuristic got wrong: it excluded the whole
    // deepseek family, and it admitted phi3, which has no tool slot at all.
    vi.stubGlobal('fetch', show(['completion', 'tools', 'thinking']))
    await expect(ollamaProvider.supportsTools('deepseek-v4-flash:cloud', { baseUrl: 'http://a' })).resolves.toBe(true)

    vi.stubGlobal('fetch', show(['completion']))
    await expect(ollamaProvider.supportsTools('phi3:mini', { baseUrl: 'http://a' })).resolves.toBe(false)
  })

  it('asks the endpoint once per model and remembers the answer', async () => {
    const fetchMock = show(['completion', 'tools'])
    vi.stubGlobal('fetch', fetchMock)

    await ollamaProvider.supportsTools('cached-model', { baseUrl: 'http://cache-test' })
    await ollamaProvider.supportsTools('cached-model', { baseUrl: 'http://cache-test' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('takes the capabilities straight off a model listing, with no extra request', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ models: [
        { name: 'minimax-m2:cloud', capabilities: ['completion', 'tools', 'thinking'] },
        { name: 'x/flux2-klein:latest', capabilities: ['image'] },
      ] }),
    })))
    await ollamaProvider.listModels('http://listed')

    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('must not be asked again') }))
    await expect(ollamaProvider.supportsTools('minimax-m2:cloud', { baseUrl: 'http://listed' })).resolves.toBe(true)
    await expect(ollamaProvider.supportsTools('x/flux2-klein:latest', { baseUrl: 'http://listed' })).resolves.toBe(false)
  })

  it('falls back to the name when the endpoint cannot answer', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    await expect(ollamaProvider.supportsTools('llama3.1:8b', { baseUrl: 'http://down' })).resolves.toBe(true)
    await expect(ollamaProvider.supportsTools('deepseek-r1:14b', { baseUrl: 'http://down' })).resolves.toBe(false)
    await expect(ollamaProvider.supportsTools('deepseek-v4-flash:cloud', { baseUrl: 'http://down' })).resolves.toBe(true)
    await expect(ollamaProvider.supportsTools('')).resolves.toBe(true)
    await expect(ollamaProvider.supportsTools(undefined)).resolves.toBe(true)
  })

  it('falls back when an older Ollama reports no capabilities at all', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ details: {} }) })))
    await expect(ollamaProvider.supportsTools('phi3:mini', { baseUrl: 'http://old' })).resolves.toBe(true)
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

  it('includes native thinking only when requested', () => {
    const req = ollamaProvider.buildChatRequest({ baseUrl: 'http://x', model: 'qwen3', messages: [], think: true })
    expect(req.body.think).toBe(true)
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

  it('emits native thinking separately from visible content', () => {
    const parser = ollamaProvider.createStreamParser()
    const events = [
      ...parser.push(line({ message: { thinking: 'plan' } })),
      ...parser.push(line({ message: { content: 'answer' } })),
    ]

    expect(events.map(e => e.type)).toEqual(['thinking', 'delta'])
    expect(events[0].text).toBe('plan')
    expect(events[1].text).toBe('answer')
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
