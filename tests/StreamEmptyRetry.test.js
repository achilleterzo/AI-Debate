import { describe, expect, it, vi, afterEach } from 'vitest'
import { streamChat } from '../src/debate/Stream'

afterEach(() => {
  vi.unstubAllGlobals()
})

function mockEmptyThenContentFetch(contents) {
  let call = 0
  return vi.fn(async () => {
    const content = contents[call] ?? ''
    call += 1
    const line = JSON.stringify({ message: { role: 'assistant', content }, done: true }) + '\n'
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(line))
        controller.close()
      },
    })
    return { ok: true, body: stream }
  })
}

function mockStreamedFetch(chunks) {
  return vi.fn(async () => ({
    ok: true,
    body: new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk))
        controller.close()
      },
    }),
  }))
}

describe('streamChat content assembly through the provider seam', () => {
  it('joins deltas arriving in separate chunks', async () => {
    const fetchMock = mockStreamedFetch([
      JSON.stringify({ message: { content: 'Hello' } }) + '\n',
      JSON.stringify({ message: { content: ', world' } }) + '\n',
      JSON.stringify({ done: true, message: { content: '' } }) + '\n',
    ])
    vi.stubGlobal('fetch', fetchMock)

    const tokens = []
    let debugPayload
    let debugResponse
    const result = await streamChat({
      baseUrl: 'http://fake',
      model: 'test-model',
      messages: [{ role: 'user', content: 'hi' }],
      systemPrompt: 'sys',
      useTools: false,
      onToken: t => tokens.push(t),
      onPayload: payload => { debugPayload = payload },
      onResponse: response => { debugResponse = response },
    })

    expect(result).toBe('Hello, world')
    expect(tokens.at(-1)).toBe('Hello, world')
    expect(fetchMock.mock.calls[0][0]).toBe('http://fake/api/chat')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      model: 'test-model',
      stream: true,
      messages: [{ role: 'system', content: 'sys' }, { role: 'user', content: 'hi' }],
    })
    expect(debugPayload).toEqual({
      provider: 'ollama',
      url: 'http://fake/api/chat',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        model: 'test-model',
        stream: true,
        messages: [{ role: 'system', content: 'sys' }, { role: 'user', content: 'hi' }],
      },
    })
    expect(debugResponse).toEqual({
      request: debugPayload,
      response: {
        message: {
          role: 'assistant',
          content: 'Hello, world',
          contentLength: 12,
        },
      },
    })
  })

  it('survives a JSON line split across the chunk boundary', async () => {
    const payload = JSON.stringify({ message: { content: 'unbroken' } }) + '\n'
    const cut = Math.floor(payload.length / 2)
    vi.stubGlobal('fetch', mockStreamedFetch([
      payload.slice(0, cut),
      payload.slice(cut),
      JSON.stringify({ done: true, message: { content: '' } }) + '\n',
    ]))

    const result = await streamChat({
      baseUrl: 'http://fake',
      model: 'test-model',
      messages: [{ role: 'user', content: 'hi' }],
      systemPrompt: 'sys',
      useTools: false,
      onToken: () => {},
    })

    expect(result).toBe('unbroken')
  })

  it('keeps each participant intervention as a distinct user message', async () => {
    const fetchMock = mockStreamedFetch([
      JSON.stringify({ message: { content: 'reply' } }) + '\n',
      JSON.stringify({ done: true, message: { content: '' } }) + '\n',
    ])
    vi.stubGlobal('fetch', fetchMock)

    await streamChat({
      baseUrl: 'http://fake',
      model: 'test-model',
      systemPrompt: 'sys',
      messages: [
        { role: 'user', content: '[Conversation summary so far]\nSummary' },
        { role: 'assistant', content: 'Elena said: My previous turn' },
        { role: 'user', content: 'Walter said: First reply' },
        { role: 'user', content: 'Leonardo said: Second reply' },
        { role: 'user', content: 'Mateo said: Third reply' },
      ],
      useTools: false,
      onToken: () => {},
    })

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.messages).toEqual([
      { role: 'system', content: 'sys' },
      { role: 'user', content: '[Conversation summary so far]\nSummary' },
      { role: 'assistant', content: 'Elena said: My previous turn' },
      { role: 'user', content: 'Walter said: First reply' },
      { role: 'user', content: 'Leonardo said: Second reply' },
      { role: 'user', content: 'Mateo said: Third reply' },
    ])
  })

  it('keeps the conversation summary when retrying a prompt that is too long', async () => {
    let call = 0
    const fetchMock = vi.fn(async () => {
      call += 1
      if (call === 1) return { ok: false, status: 400, text: async () => 'prompt too long' }
      return mockStreamedFetch([
        JSON.stringify({ message: { content: 'reply' } }) + '\n',
        JSON.stringify({ done: true, message: { content: '' } }) + '\n',
      ])()
    })
    vi.stubGlobal('fetch', fetchMock)

    await streamChat({
      baseUrl: 'http://fake',
      model: 'test-model',
      systemPrompt: 'sys',
      messages: [
        { role: 'user', content: '[Conversation summary so far]\nSummary' },
        { role: 'assistant', content: 'Elena said: My previous turn' },
        { role: 'user', content: 'Walter said: Reply' },
      ],
      useTools: false,
      onToken: () => {},
    })

    const retryBody = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(retryBody.messages).toEqual([
      { role: 'system', content: 'sys' },
      { role: 'user', content: '[Conversation summary so far]\nSummary' },
      { role: 'user', content: 'Walter said: Reply' },
    ])
  })

  it('propagates a provider error instead of returning an empty response', async () => {
    const fetchMock = mockStreamedFetch([
      JSON.stringify({ message: { content: 'partial' } }) + '\n',
      JSON.stringify({ error: 'model requires more system memory' }) + '\n',
      JSON.stringify({ done: true, message: { content: '' } }) + '\n',
    ])
    vi.stubGlobal('fetch', fetchMock)

    await expect(streamChat({
      baseUrl: 'http://fake',
      model: 'test-model',
      messages: [{ role: 'user', content: 'hi' }],
      systemPrompt: 'sys',
      useTools: false,
      onToken: () => {},
    })).rejects.toThrow('model requires more system memory')

    // The error must end the turn, not trigger the empty-response retry.
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('strips <think> blocks from the visible output', async () => {
    vi.stubGlobal('fetch', mockStreamedFetch([
      JSON.stringify({ message: { content: '<think>hidden</think>visible' } }) + '\n',
      JSON.stringify({ done: true, message: { content: '' } }) + '\n',
    ]))

    const result = await streamChat({
      baseUrl: 'http://fake',
      model: 'test-model',
      messages: [{ role: 'user', content: 'hi' }],
      systemPrompt: 'sys',
      useTools: false,
      onToken: () => {},
    })

    expect(result).toBe('visible')
  })
})

describe('streamChat empty response handling', () => {
  it('retries once when the model returns an empty response, then returns the retried content', async () => {
    const fetchMock = mockEmptyThenContentFetch(['', 'hello after retry'])
    vi.stubGlobal('fetch', fetchMock)

    const tokens = []
    const result = await streamChat({
      baseUrl: 'http://fake',
      model: 'test-model',
      messages: [{ role: 'user', content: 'hi' }],
      systemPrompt: 'sys',
      useTools: false,
      onToken: t => tokens.push(t),
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result).toBe('hello after retry')
  })

  it('returns empty string (not throw) if the retry is also empty', async () => {
    const fetchMock = mockEmptyThenContentFetch(['', ''])
    vi.stubGlobal('fetch', fetchMock)

    const result = await streamChat({
      baseUrl: 'http://fake',
      model: 'test-model',
      messages: [{ role: 'user', content: 'hi' }],
      systemPrompt: 'sys',
      useTools: false,
      onToken: () => {},
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result).toBe('')
  })
})
