import { describe, expect, it, vi, afterEach, beforeAll } from 'vitest'
import { streamChat } from '../src/debate/Stream'
import { ollamaProvider } from '../src/providers/ollama'
import { Web } from '../src/services/Web'

// A turn asks the endpoint what the model can do before offering it any tool.
// In the app the model picker has already answered that; here nothing has run
// yet, so the listing is replayed once and every test starts from a warm cache
// instead of an unexpected /api/show landing in its fetch mock.
beforeAll(async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({ models: [{ name: 'test-model', capabilities: ['completion', 'tools', 'thinking'] }] }),
  })))
  await ollamaProvider.listModels('http://fake')
  vi.unstubAllGlobals()
})

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
        think: true,
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

  it('preserves text emitted before a tool call when continuing the stream', async () => {
    let call = 0
    const fetchMock = vi.fn(async () => {
      call += 1
      const lines = call === 1
        ? [
            JSON.stringify({ message: { content: 'The scene begins.' } }) + '\n',
            JSON.stringify({ message: { tool_calls: [{ function: { name: 'roll_dice', arguments: { count: 1, sides: 6 } } }] } }) + '\n',
            JSON.stringify({ done: true, message: { content: '' } }) + '\n',
          ]
        : [
            JSON.stringify({ message: { content: 'The result changes everything.' } }) + '\n',
            JSON.stringify({ done: true, message: { content: '' } }) + '\n',
          ]
      return {
        ok: true,
        body: new ReadableStream({
          start(controller) {
            for (const line of lines) controller.enqueue(new TextEncoder().encode(line))
            controller.close()
          },
        }),
      }
    })
    vi.stubGlobal('fetch', fetchMock)

    const tokens = []
    const result = await streamChat({
      baseUrl: 'http://fake',
      model: 'test-model',
      messages: [{ role: 'user', content: 'continue' }],
      useTools: true,
      tools: [{ type: 'function', function: { name: 'roll_dice' } }],
      executeTool: async () => 'rolled: 4',
      onToken: token => tokens.push(token),
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result).toBe('The scene begins.\n\nThe result changes everything.')
    expect(tokens).not.toContain('')
    expect(tokens.at(-1)).toBe(result)
  })

  it('can expose tool continuations as separate response segments', async () => {
    let call = 0
    vi.stubGlobal('fetch', vi.fn(async () => {
      call += 1
      const lines = call === 1
        ? [
            JSON.stringify({ message: { content: 'First moderator segment.' } }) + '\n',
            JSON.stringify({ message: { tool_calls: [{ function: { name: 'request_moderator_intervention', arguments: {} } }] } }) + '\n',
            JSON.stringify({ done: true, message: { content: '' } }) + '\n',
          ]
        : [
            JSON.stringify({ message: { content: 'Second segment.' } }) + '\n',
            JSON.stringify({ done: true, message: { content: '' } }) + '\n',
          ]
      return {
        ok: true,
        body: new ReadableStream({
          start(controller) {
            for (const line of lines) controller.enqueue(new TextEncoder().encode(line))
            controller.close()
          },
        }),
      }
    }))

    const segments = []
    const result = await streamChat({
      baseUrl: 'http://fake',
      model: 'test-model',
      messages: [{ role: 'user', content: 'continue' }],
      useTools: true,
      tools: [{ type: 'function', function: { name: 'request_moderator_intervention' } }],
      executeTool: async () => 'accepted',
      onToolRound: segment => segments.push(segment),
      onToken: () => {},
    })

    expect(segments).toHaveLength(1)
    expect(segments[0].content).toBe('First moderator segment.')
    expect(result).toBe('Second segment.')
  })

  it('drops repeated tool continuations and isolated JSON delimiters', async () => {
    let call = 0
    vi.stubGlobal('fetch', vi.fn(async () => {
      call += 1
      const content = call === 1 ? 'Original response.' : (call === 2 ? 'Original response.' : '}')
      const lines = call === 1
        ? [
            JSON.stringify({ message: { content } }) + '\n',
            JSON.stringify({ message: { tool_calls: [{ function: { name: 'roll_dice', arguments: { count: 1, sides: 20 } } }] } }) + '\n',
            JSON.stringify({ done: true, message: { content: '' } }) + '\n',
          ]
        : [
            JSON.stringify({ message: { content } }) + '\n',
            JSON.stringify({ done: true, message: { content: '' } }) + '\n',
          ]
      return {
        ok: true,
        body: new ReadableStream({
          start(controller) {
            for (const line of lines) controller.enqueue(new TextEncoder().encode(line))
            controller.close()
          },
        }),
      }
    }))

    const segments = []
    const result = await streamChat({
      baseUrl: 'http://fake',
      model: 'test-model',
      messages: [{ role: 'user', content: 'continue' }],
      useTools: true,
      tools: [{ type: 'function', function: { name: 'roll_dice' } }],
      executeTool: async () => 'rolled',
      onToolRound: segment => segments.push(segment),
      onToken: () => {},
    })

    expect(segments).toHaveLength(1)
    expect(result).toBe('')
  })

  it('does not expose leaked channel markers as assistant content', async () => {
    let call = 0
    vi.stubGlobal('fetch', vi.fn(async () => {
      call += 1
      const content = call === 1 ? '<channel|>' : 'Valid continuation.'
      const line = JSON.stringify({ message: { content } }) + '\n'
      const done = JSON.stringify({ done: true, done_reason: 'stop', message: { content: '' } }) + '\n'
      return {
        ok: true,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(line))
            controller.enqueue(new TextEncoder().encode(done))
            controller.close()
          },
        }),
      }
    }))

    const result = await streamChat({
      baseUrl: 'http://fake',
      model: 'test-model',
      messages: [{ role: 'user', content: 'continue' }],
      onToken: () => {},
    })

    expect(result).toBe('Valid continuation.')
  })

  it('does not expose malformed structured tool JSON or transport turn markers', async () => {
    const fetchMock = mockEmptyThenContentFetch([
      '```json\n{"action":"write","content":"do not execute this"}\n```<turn|>',
      'Valid continuation after invalid tool syntax.',
    ])
    vi.stubGlobal('fetch', fetchMock)

    const result = await streamChat({
      baseUrl: 'http://fake',
      model: 'test-model',
      messages: [{ role: 'user', content: 'continue' }],
      onToken: () => {},
    })

    expect(result).toBe('Valid continuation after invalid tool syntax.')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not execute textual inline tool calls', async () => {
    let call = 0
    vi.stubGlobal('fetch', vi.fn(async () => {
      call += 1
      const lines = call === 1
        ? [
            JSON.stringify({ message: { content: 'I will roll now. roll_dice(count=2, sides=10)' } }) + '\n',
            JSON.stringify({ done: true, message: { content: '' } }) + '\n',
          ]
        : [
            JSON.stringify({ message: { content: 'The result is decisive.' } }) + '\n',
            JSON.stringify({ done: true, message: { content: '' } }) + '\n',
          ]
      return {
        ok: true,
        body: new ReadableStream({
          start(controller) {
            for (const line of lines) controller.enqueue(new TextEncoder().encode(line))
            controller.close()
          },
        }),
      }
    }))

    const invocations = []
    const tokens = []
    const result = await streamChat({
      baseUrl: 'http://fake',
      model: 'test-model',
      messages: [{ role: 'user', content: 'roll' }],
      useTools: true,
      tools: [{ type: 'function', function: { name: 'roll_dice' } }],
      executeTool: async (name, args) => {
        invocations.push({ name, args })
        return 'rolled'
      },
      onToken: token => tokens.push(token),
    })

    expect(invocations).toEqual([])
    expect(result).toContain('roll_dice(count=2, sides=10)')
    expect(tokens.some(token => token.includes('roll_dice(count=2'))).toBe(true)
  })

  it('recognizes backticked dice notation emitted as text', async () => {
    let call = 0
    let receivedArgs = null
    vi.stubGlobal('fetch', vi.fn(async () => {
      call += 1
      const content = call === 1 ? 'I act now. `roll_dice`(1d20)' : 'The roll decides the outcome.'
      const lines = call === 1
        ? [
            JSON.stringify({ message: { content } }) + '\n',
            JSON.stringify({ done: true, done_reason: 'stop', message: { content: '' } }) + '\n',
          ]
        : [
            JSON.stringify({ message: { content } }) + '\n',
            JSON.stringify({ done: true, done_reason: 'stop', message: { content: '' } }) + '\n',
          ]
      return {
        ok: true,
        body: new ReadableStream({
          start(controller) {
            for (const line of lines) controller.enqueue(new TextEncoder().encode(line))
            controller.close()
          },
        }),
      }
    }))

    const result = await streamChat({
      baseUrl: 'http://fake',
      model: 'test-model',
      messages: [{ role: 'user', content: 'continue' }],
      useTools: true,
      tools: [{ type: 'function', function: { name: 'roll_dice' } }],
      executeTool: async (name, args) => {
        receivedArgs = { name, args }
        return 'rolled: 15'
      },
      onToken: () => {},
    })

    expect(receivedArgs).toBeNull()
    expect(result).toContain('`roll_dice`(1d20)')
    expect(result).not.toContain('The roll decides the outcome.')
  })

  it('recognizes inline tool calls written with an object argument', async () => {
    let call = 0
    let receivedArgs = null
    vi.stubGlobal('fetch', vi.fn(async () => {
      call += 1
      const content = call === 1 ? "I record this. memory {action: 'write', content: 'A durable note'}" : 'The note is stored.'
      const lines = [
        JSON.stringify({ message: { content } }) + '\n',
        JSON.stringify({ done: true, done_reason: 'stop', message: { content: '' } }) + '\n',
      ]
      return {
        ok: true,
        body: new ReadableStream({
          start(controller) {
            for (const line of lines) controller.enqueue(new TextEncoder().encode(line))
            controller.close()
          },
        }),
      }
    }))

    const result = await streamChat({
      baseUrl: 'http://fake',
      model: 'test-model',
      messages: [{ role: 'user', content: 'continue' }],
      useTools: true,
      tools: [{ type: 'function', function: { name: 'memory' } }],
      executeTool: async (name, args) => {
        receivedArgs = { name, args }
        return 'saved'
      },
      onToken: () => {},
    })

    expect(receivedArgs).toBeNull()
    expect(result).toContain("memory {action: 'write', content: 'A durable note'}")
    expect(result).not.toContain('The note is stored.')
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

describe('prompt scaffolding in the visible answer', () => {
  it('strips the delimiters the model echoes back', async () => {
    const leaked = 'Ecco la mia posizione.\n</conversation_context>\n<fetched_sources>Fine.'
    vi.stubGlobal('fetch', mockStreamedFetch([
      JSON.stringify({ message: { content: leaked } }) + '\n',
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

    expect(result).not.toContain('conversation_context')
    expect(result).not.toContain('fetched_sources')
    expect(result).toContain('Ecco la mia posizione.')
    expect(result).toContain('Fine.')
  })
})

describe('a turn that spends itself on tools', () => {
  function toolCall(name) {
    return JSON.stringify({ message: { tool_calls: [{ function: { name, arguments: {} } }] } }) + '\n'
  }
  const doneEmpty = JSON.stringify({ done: true, message: { content: '' } }) + '\n'

  function bodyOf(lines) {
    return {
      ok: true,
      body: new ReadableStream({
        start(controller) {
          for (const line of lines) controller.enqueue(new TextEncoder().encode(line))
          controller.close()
        },
      }),
    }
  }

  const NUDGE = /Tool use for this turn is over/

  // web_search runs its own fetch inside the tool loop, so the model calls are
  // only the ones carrying a chat payload.
  function modelRequests(fetchMock) {
    return fetchMock.mock.calls
      .filter(call => call[1]?.body)
      .map(call => JSON.parse(call[1].body).messages)
  }

  it('tells the model to answer once the tool rounds are spent', async () => {
    let call = 0
    const fetchMock = vi.fn(async () => {
      call += 1
      // Two rounds of tool calls, then the model is out of rounds.
      if (call <= 2) return bodyOf([toolCall('roll_dice'), doneEmpty])
      return bodyOf([JSON.stringify({ message: { content: 'Ecco la mia analisi.' } }) + '\n', doneEmpty])
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await streamChat({
      baseUrl: 'http://fake',
      model: 'test-model',
      messages: [{ role: 'user', content: 'valuta' }],
      useTools: true,
      tools: [{ type: 'function', function: { name: 'roll_dice' } }],
      executeTool: async () => 'rolled: 4',
      onToken: () => {},
    })

    expect(result).toBe('Ecco la mia analisi.')
    const requests = modelRequests(fetchMock)
    expect(requests).toHaveLength(3)
    expect(requests[2].at(-1).content).toMatch(NUDGE)
    // Not before it is due: after the first tool round a round was still left.
    expect(requests[1].some(message => NUDGE.test(message.content))).toBe(false)
  })

  it('asks for the answer when the model replies with silence', async () => {
    let call = 0
    const fetchMock = vi.fn(async () => {
      call += 1
      if (call === 1) return bodyOf([doneEmpty])
      return bodyOf([JSON.stringify({ message: { content: 'Eccomi.' } }) + '\n', doneEmpty])
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await streamChat({
      baseUrl: 'http://fake',
      model: 'test-model',
      messages: [{ role: 'user', content: 'parla' }],
      useTools: false,
      onToken: () => {},
    })

    expect(result).toBe('Eccomi.')
    expect(modelRequests(fetchMock)[1].at(-1).content).toMatch(NUDGE)
  })

  it('treats an answer made only of scaffolding as no answer at all', async () => {
    let call = 0
    const fetchMock = vi.fn(async () => {
      call += 1
      if (call === 1) return bodyOf([
        JSON.stringify({ message: { content: '<conversation_context>\nMarco said: ...\n</conversation_context>' } }) + '\n',
        doneEmpty,
      ])
      return bodyOf([JSON.stringify({ message: { content: 'La mia posizione è questa.' } }) + '\n', doneEmpty])
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await streamChat({
      baseUrl: 'http://fake',
      model: 'test-model',
      messages: [{ role: 'user', content: 'parla' }],
      useTools: false,
      onToken: () => {},
    })

    expect(result).toBe('La mia posizione è questa.')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('a model that types the tool call instead of emitting it', () => {
  const doneEmpty = JSON.stringify({ done: true, message: { content: '' } }) + '\n'

  function bodyOf(lines) {
    return {
      ok: true,
      body: new ReadableStream({
        start(controller) {
          for (const line of lines) controller.enqueue(new TextEncoder().encode(line))
          controller.close()
        },
      }),
    }
  }

  function answerOf(content) {
    vi.stubGlobal('fetch', vi.fn(async () => bodyOf([
      JSON.stringify({ message: { content } }) + '\n',
      doneEmpty,
    ])))
    return streamChat({
      baseUrl: 'http://fake',
      model: 'test-model',
      messages: [{ role: 'user', content: 'parla' }],
      useTools: false,
      onToken: () => {},
    })
  }

  it('drops an Anthropic-style block, unbalanced wrapper included', async () => {
    const leaked = [
      'Prima di esprimere un giudizio, devo leggere il materiale.',
      '',
      '<invoke name="fetch_url">',
      '<parameter name="url">https://example.com/</parameter>',
      '</invoke>',
      '</tool_calls>',
    ].join('\n')

    await expect(answerOf(leaked)).resolves.toBe('Prima di esprimere un giudizio, devo leggere il materiale.')
  })

  it('drops a block still being typed when the stream ends', async () => {
    await expect(answerOf('Vado a controllare.\n\n<tool_calls>\n<invoke name="web_search">'))
      .resolves.toBe('Vado a controllare.')
  })

  it('leaves ordinary prose and markup alone', async () => {
    const prose = 'Il markup `<div>` resta, e 3 < 5 pure.'
    await expect(answerOf(prose)).resolves.toBe(prose)
  })

  it('treats an answer made only of a typed call as no answer at all', async () => {
    let call = 0
    const fetchMock = vi.fn(async () => {
      call += 1
      if (call === 1) return bodyOf([
        JSON.stringify({ message: { content: '<tool_calls>\n<invoke name="fetch_url">\n</invoke>\n</tool_calls>' } }) + '\n',
        doneEmpty,
      ])
      return bodyOf([JSON.stringify({ message: { content: 'La mia posizione è questa.' } }) + '\n', doneEmpty])
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await streamChat({
      baseUrl: 'http://fake',
      model: 'test-model',
      messages: [{ role: 'user', content: 'parla' }],
      useTools: false,
      onToken: () => {},
    })

    expect(result).toBe('La mia posizione è questa.')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('the tools array is sent only when there is one', () => {
  const doneEmpty = JSON.stringify({ done: true, message: { content: 'ok' } }) + '\n'

  // Answers /api/show as the real endpoint would, so the capability lookup a
  // tool-enabled turn performs is served by the declared capabilities and not
  // by an accidental parse failure falling back to the name.
  function stub(capabilities = ['completion', 'tools']) {
    const fetchMock = vi.fn(async url => String(url).endsWith('/api/show')
      ? { ok: true, json: async () => ({ capabilities }) }
      : {
          ok: true,
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(doneEmpty))
              controller.close()
            },
          }),
        })
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  function chatBody(fetchMock) {
    const chat = fetchMock.mock.calls.find(call => String(call[0]).endsWith('/api/chat'))
    return JSON.parse(chat[1].body)
  }

  it('omits an empty tools array rather than advertising nothing', async () => {
    const fetchMock = stub()
    await streamChat({
      baseUrl: 'http://fake',
      model: 'test-model',
      messages: [{ role: 'user', content: 'hi' }],
      useTools: true,
      tools: [],
      onToken: () => {},
    })
    expect(chatBody(fetchMock)).not.toHaveProperty('tools')
  })

  it('omits the tools array when the endpoint says the model has no tools', async () => {
    const fetchMock = stub(['completion'])
    await streamChat({
      baseUrl: 'http://no-tools',
      model: 'phi3:mini',
      messages: [{ role: 'user', content: 'hi' }],
      useTools: true,
      tools: [{ type: 'function', function: { name: 'web_search' } }],
      onToken: () => {},
    })
    expect(chatBody(fetchMock)).not.toHaveProperty('tools')
  })

  it('sends them when the endpoint says the model has tools', async () => {
    const tools = [{ type: 'function', function: { name: 'web_search' } }]
    const fetchMock = stub(['completion', 'tools'])
    await streamChat({
      baseUrl: 'http://with-tools',
      model: 'deepseek-v4-flash:cloud',
      messages: [{ role: 'user', content: 'hi' }],
      useTools: true,
      tools,
      onToken: () => {},
    })
    expect(chatBody(fetchMock).tools).toEqual(tools)
  })
})

describe('the think flag follows what the model can actually do', () => {
  const done = JSON.stringify({ done: true, message: { content: 'ok' } }) + '\n'

  function stub(capabilities) {
    const fetchMock = vi.fn(async url => String(url).endsWith('/api/show')
      ? { ok: true, json: async () => ({ capabilities }) }
      : {
          ok: true,
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(done))
              controller.close()
            },
          }),
        })
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  function chatBody(fetchMock) {
    return JSON.parse(fetchMock.mock.calls.find(call => String(call[0]).endsWith('/api/chat'))[1].body)
  }

  async function run(fetchMock, { model, think }) {
    await streamChat({
      baseUrl: `http://${model}`,
      model,
      messages: [{ role: 'user', content: 'hi' }],
      useTools: false,
      think,
      onToken: () => {},
    })
    return chatBody(fetchMock)
  }

  // `think: true` against a model without the capability is an HTTP 400 from
  // Ollama — the turn is lost, not silently downgraded.
  it('drops the flag for a model that cannot think', async () => {
    const fetchMock = stub(['completion', 'tools'])
    expect(await run(fetchMock, { model: 'no-think', think: 'high' })).not.toHaveProperty('think')
  })

  it('keeps it for a model that can', async () => {
    const fetchMock = stub(['completion', 'thinking'])
    expect((await run(fetchMock, { model: 'can-think', think: 'high' })).think).toBe('high')
  })

  it('never asks the endpoint when thinking is already off', async () => {
    const fetchMock = stub(['completion'])
    const body = await run(fetchMock, { model: 'thinking-off', think: false })
    expect(body.think).toBe(false)
    expect(fetchMock.mock.calls.some(call => String(call[0]).endsWith('/api/show'))).toBe(false)
  })
})

describe('a tool result keeps the size the page-block setting gave it', () => {
  const doneEmpty = JSON.stringify({ done: true, message: { content: '' } }) + '\n'
  const toolCall = JSON.stringify({ message: { tool_calls: [{ function: { name: 'fetch_url', arguments: { url: 'http://page' } } }] } }) + '\n'

  function bodyOf(lines) {
    return {
      ok: true,
      body: new ReadableStream({
        start(controller) {
          for (const line of lines) controller.enqueue(new TextEncoder().encode(line))
          controller.close()
        },
      }),
    }
  }

  it('sends a 64 KB block whole instead of cutting it to the prose budget', async () => {
    const block = 'x'.repeat(64 * 1024)
    Web.configure({ pageBlockKb: 64 })
    vi.spyOn(Web, 'readUrl').mockResolvedValue({ text: block, status: 'ok', page: 1, pageCount: 1, url: 'http://page' })

    let call = 0
    const fetchMock = vi.fn(async url => {
      if (String(url).endsWith('/api/show')) return { ok: true, json: async () => ({ capabilities: ['completion', 'tools'] }) }
      call += 1
      return call === 1
        ? bodyOf([toolCall, doneEmpty])
        : bodyOf([JSON.stringify({ message: { content: 'Letto.' } }) + '\n', doneEmpty])
    })
    vi.stubGlobal('fetch', fetchMock)

    await streamChat({
      baseUrl: 'http://fake',
      model: 'test-model',
      messages: [{ role: 'user', content: 'leggi' }],
      useTools: true,
      tools: [{ type: 'function', function: { name: 'fetch_url' } }],
      onToken: () => {},
    })

    const second = JSON.parse(fetchMock.mock.calls.filter(c => String(c[0]).endsWith('/api/chat'))[1][1].body)
    const toolMessage = second.messages.find(message => message.role === 'tool')
    expect(toolMessage.content).toHaveLength(block.length)
    expect(toolMessage.content).not.toContain('truncated for context')

    Web.readUrl.mockRestore()
  })

  it('still bounds a tool that returns far more than the configured block', async () => {
    Web.configure({ pageBlockKb: 8 })
    const runaway = 'y'.repeat(400 * 1024)
    vi.spyOn(Web, 'readUrl').mockResolvedValue({ text: runaway, status: 'ok', page: 1, pageCount: 1, url: 'http://page' })

    let call = 0
    const fetchMock = vi.fn(async url => {
      if (String(url).endsWith('/api/show')) return { ok: true, json: async () => ({ capabilities: ['completion', 'tools'] }) }
      call += 1
      return call === 1
        ? bodyOf([toolCall, doneEmpty])
        : bodyOf([JSON.stringify({ message: { content: 'Letto.' } }) + '\n', doneEmpty])
    })
    vi.stubGlobal('fetch', fetchMock)

    await streamChat({
      baseUrl: 'http://fake',
      model: 'test-model',
      messages: [{ role: 'user', content: 'leggi' }],
      useTools: true,
      tools: [{ type: 'function', function: { name: 'fetch_url' } }],
      onToken: () => {},
    })

    const second = JSON.parse(fetchMock.mock.calls.filter(c => String(c[0]).endsWith('/api/chat'))[1][1].body)
    const toolMessage = second.messages.find(message => message.role === 'tool')
    expect(toolMessage.content.length).toBeLessThan(runaway.length)
    expect(toolMessage.content).toContain('truncated for context')

    Web.readUrl.mockRestore()
    Web.configure({ pageBlockKb: 8 })
  })
})

describe('a tool asked the same thing twice in one turn', () => {
  const PAGE = 'PAGEBODY'.repeat(3343)
  const done = JSON.stringify({ done: true, message: { content: '' } }) + '\n'
  const bodyOf = lines => ({
    ok: true,
    body: new ReadableStream({
      start(controller) {
        for (const line of lines) controller.enqueue(new TextEncoder().encode(line))
        controller.close()
      },
    }),
  })
  const callLine = args => JSON.stringify({ message: { tool_calls: [{ function: { name: 'fetch_url', arguments: args } }] } }) + '\n'

  function run(argsPerRound) {
    let round = 0
    const fetchMock = vi.fn(async url => {
      if (String(url).endsWith('/api/show')) return { ok: true, json: async () => ({ capabilities: ['completion', 'tools'] }) }
      const args = argsPerRound[round]
      round += 1
      return args
        ? bodyOf([callLine(args), done])
        : bodyOf([JSON.stringify({ message: { content: 'Ho letto.' } }) + '\n', done])
    })
    vi.stubGlobal('fetch', fetchMock)
    return { fetchMock, promise: streamChat({
      baseUrl: 'http://fake',
      model: 'test-model',
      messages: [{ role: 'user', content: 'valuta' }],
      useTools: true,
      tools: [{ type: 'function', function: { name: 'fetch_url' } }],
      onToken: () => {},
    }) }
  }

  function toolMessages(fetchMock) {
    const chats = fetchMock.mock.calls.filter(c => String(c[0]).endsWith('/api/chat')).map(c => JSON.parse(c[1].body))
    return chats.at(-1).messages.filter(message => message.role === 'tool')
  }

  // The block size is process-wide config, so each case states the one it needs
  // instead of inheriting whatever the previous test left behind.
  it('points at the copy already in the conversation instead of sending a second one', async () => {
    Web.configure({ pageBlockKb: 64 })
    vi.spyOn(Web, 'readUrl').mockResolvedValue({ text: PAGE, status: 'ok', page: 1, pageCount: 1, url: 'http://page' })
    const { fetchMock, promise } = run([{ url: 'http://page' }, { url: 'http://page' }])
    await promise

    const results = toolMessages(fetchMock)
    expect(results).toHaveLength(2)
    expect(results[0].content).toBe(PAGE)
    expect(results[1].content).not.toContain('PAGEBODY')
    expect(results[1].content).toContain('already ran in this turn')
    Web.readUrl.mockRestore()
  })

  it('treats the same arguments written in a different order as the same call', async () => {
    Web.configure({ pageBlockKb: 64 })
    vi.spyOn(Web, 'readUrl').mockResolvedValue({ text: PAGE, status: 'ok', page: 2, pageCount: 3, url: 'http://page' })
    const { fetchMock, promise } = run([{ url: 'http://page', page: 2 }, { page: 2, url: 'http://page' }])
    await promise

    expect(toolMessages(fetchMock)[1].content).not.toContain('PAGEBODY')
    Web.readUrl.mockRestore()
  })

  it('still sends a different block of the same page in full', async () => {
    Web.configure({ pageBlockKb: 64 })
    vi.spyOn(Web, 'readUrl').mockImplementation(async (url, { page }) => ({
      text: `BLOCK${page}`.repeat(2000), status: 'partial', page, pageCount: 3, url,
    }))
    const { fetchMock, promise } = run([{ url: 'http://page', page: 1 }, { url: 'http://page', page: 2 }])
    await promise

    const results = toolMessages(fetchMock)
    expect(results[0].content).toContain('BLOCK1')
    expect(results[1].content).toContain('BLOCK2')
    expect(results[1].content).not.toContain('already ran in this turn')
    Web.readUrl.mockRestore()
  })
})
