import { afterEach, describe, expect, it, vi } from 'vitest'
import { geminiProvider, GEMINI_URL } from '../src/providers/gemini.js'
import { openRouterProvider, OPENROUTER_URL } from '../src/providers/openRouter.js'
import { openAiEffort, toOpenAiMessages } from '../src/providers/openAiCompatible.js'
import { configureHostedKey } from '../src/providers/hosted.js'
import { getProvider, setActiveProviderId } from '../src/providers/index.js'
import { streamChat } from '../src/debate/Stream.js'
import { ROLL_DICE_TOOL } from '../src/tools/DiceTool'

afterEach(() => {
  configureHostedKey('openrouter', { apiKey: '' })
  configureHostedKey('gemini', { apiKey: '' })
  setActiveProviderId('ollama')
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const sse = value => `data: ${JSON.stringify(value)}\n\n`
const delta = value => ({ choices: [{ delta: value }] })

/** A bridge that plays one scripted SSE answer, as the main process would. */
function scriptedBridge(chunks, { status = 200 } = {}) {
  const requests = []
  const aiApiStream = vi.fn((request, onEvent) => {
    requests.push(request)
    queueMicrotask(() => {
      onEvent({ type: 'start', status })
      for (const chunk of chunks) onEvent({ type: 'chunk', chunk })
      onEvent({ type: 'end' })
    })
  })
  return { desktop: { aiApiStream, aiApiStreamCleanup: vi.fn(), aiApiCancel: vi.fn() }, requests, aiApiStream }
}

describe('the OpenAI-compatible providers', () => {
  it('are both selectable, each with its own endpoint', () => {
    setActiveProviderId('openrouter')
    expect(getProvider()).toBe(openRouterProvider)
    setActiveProviderId('gemini')
    expect(getProvider()).toBe(geminiProvider)
    expect(openRouterProvider.buildChatRequest({ model: 'x', messages: [] }).url).toBe(`${OPENROUTER_URL}/chat/completions`)
    expect(geminiProvider.buildChatRequest({ model: 'x', messages: [] }).url).toBe(`${GEMINI_URL}/chat/completions`)
  })

  it('names the reasoning effort the way each API takes it', () => {
    const openRouter = openRouterProvider.buildChatRequest({ model: 'x', messages: [], think: 'high' }).body
    const gemini = geminiProvider.buildChatRequest({ model: 'x', messages: [], think: 'high' }).body
    expect(openRouter.reasoning).toEqual({ effort: 'high' })
    expect(gemini.reasoning_effort).toBe('high')
    // `max` is above what these APIs offer, and `none` sends no parameter.
    expect(openAiEffort('max')).toBe('high')
    expect(openAiEffort('none')).toBe('')
    expect(openRouterProvider.buildChatRequest({ model: 'x', messages: [], think: false }).body).not.toHaveProperty('reasoning')
  })

  it('sends only the generation parameters that were set', () => {
    const body = geminiProvider.buildChatRequest({ model: 'x', messages: [], options: { temperature: 0.3, numPredict: 2048 } }).body
    expect(body).toMatchObject({ temperature: 0.3, max_tokens: 2048 })
    expect(geminiProvider.buildChatRequest({ model: 'x', messages: [] }).body).not.toHaveProperty('temperature')
  })

  it('offers the tools without the app’s own extra fields', () => {
    const body = openRouterProvider.buildChatRequest({ model: 'x', messages: [], tools: [ROLL_DICE_TOOL] }).body
    expect(body.tools).toHaveLength(1)
    expect(body.tools[0].function.name).toBe('roll_dice')
    expect(body.tools[0].function).not.toHaveProperty('constraints')
    expect(JSON.stringify(body.tools)).not.toContain('MANDATORY')
  })

  it('ties a tool result back to the call it answers', () => {
    const messages = toOpenAiMessages([
      { role: 'user', content: 'Roll for it.' },
      { role: 'assistant', content: 'Rolling.', tool_calls: [{ function: { name: 'roll_dice', arguments: { count: 1, sides: 20 } } }] },
      { role: 'tool', tool_name: 'roll_dice', content: '17' },
    ])
    expect(messages[1].tool_calls[0]).toMatchObject({ type: 'function', function: { name: 'roll_dice', arguments: '{"count":1,"sides":20}' } })
    expect(messages[2]).toEqual({ role: 'tool', tool_call_id: messages[1].tool_calls[0].id, content: '17' })
  })

  it('hands over an orphaned tool result as plain text', () => {
    expect(toOpenAiMessages([{ role: 'tool', tool_name: 'web_search', content: 'nothing' }]))
      .toEqual([{ role: 'user', content: '[Result of web_search]\nnothing' }])
  })

  it('attaches an image as a data URI part', () => {
    const [message] = toOpenAiMessages([{ role: 'user', content: 'Look', images: ['/9j/base64jpeg'] }])
    expect(message.content[0]).toEqual({ type: 'text', text: 'Look' })
    expect(message.content[1].image_url.url).toBe('data:image/jpeg;base64,/9j/base64jpeg')
  })

  it('streams text and reasoning apart, and reassembles a split tool call', async () => {
    const parser = openRouterProvider.createStreamParser()
    const events = [
      ...parser.push(sse(delta({ reasoning: 'Weighing it.' }))),
      ...parser.push(sse(delta({ content: 'Rolling' }))),
      ...parser.push(sse(delta({ tool_calls: [{ index: 0, id: 'call_1', function: { name: 'roll_dice', arguments: '' } }] }))),
      ...parser.push(sse(delta({ tool_calls: [{ index: 0, function: { arguments: '{"count":1,' } }] }))),
      ...parser.push(sse(delta({ tool_calls: [{ index: 0, function: { arguments: '"sides":20}' } }] }))),
      ...parser.push(sse({ choices: [{ delta: {}, finish_reason: 'tool_calls' }] })),
      ...parser.push('data: [DONE]\n\n'),
      ...parser.flush(),
    ]
    expect(events).toEqual([
      { type: 'thinking', text: 'Weighing it.' },
      { type: 'delta', text: 'Rolling' },
      { type: 'toolCalls', toolCalls: [{ function: { name: 'roll_dice', arguments: { count: 1, sides: 20 } } }] },
      { type: 'done', content: '', doneReason: 'tool_calls' },
    ])
  })

  it('keeps the first of two calls numbered the same way', () => {
    const parser = geminiProvider.createStreamParser()
    const events = [
      ...parser.push(sse(delta({ tool_calls: [{ index: 0, id: 'a', function: { name: 'roll_dice', arguments: '{"count":1,"sides":6}' } }] }))),
      ...parser.push(sse(delta({ tool_calls: [{ index: 0, id: 'b', function: { name: 'web_search', arguments: '{"query":"x"}' } }] }))),
      ...parser.flush(),
    ]
    expect(events).toEqual([{ type: 'toolCalls', toolCalls: [{ function: { name: 'roll_dice', arguments: { count: 1, sides: 6 } } }] }, { type: 'done', content: '', doneReason: null }])
  })

  it('reports an error that arrived inside the stream', () => {
    const parser = geminiProvider.createStreamParser()
    expect(parser.push(sse({ error: { message: 'upstream unavailable' } })))
      .toEqual([{ type: 'error', message: 'upstream unavailable' }])
  })

  it('ends a stream that stopped without a finish reason', () => {
    const parser = geminiProvider.createStreamParser()
    expect(parser.push(sse(delta({ content: 'Half' })))).toEqual([{ type: 'delta', text: 'Half' }])
    expect(parser.flush()).toEqual([{ type: 'done', content: '', doneReason: null }])
  })

  it('runs a whole turn through streamChat with the key kept out of the payload', async () => {
    configureHostedKey('gemini', { apiKey: 'secret-key' })
    const { desktop, requests } = scriptedBridge([
      sse(delta({ reasoning: 'Thinking.' })),
      sse(delta({ content: 'Hosted answer' })),
      sse({ choices: [{ delta: {}, finish_reason: 'stop' }] }),
    ])
    vi.stubGlobal('window', { desktop })
    let debugPayload
    let thinking = ''
    let answer = ''

    const result = await streamChat({
      model: 'gemini-3-pro',
      messages: [{ role: 'user', content: 'Hello' }],
      provider: geminiProvider,
      onToken: token => { answer = token },
      onPayload: payload => { debugPayload = payload },
      onThinking: value => { thinking = value },
    })

    expect(result).toBe('Hosted answer')
    expect(answer).toBe('Hosted answer')
    expect(thinking).toBe('Thinking.')
    expect(requests[0]).toMatchObject({ provider: 'gemini', path: '/chat/completions', apiKey: 'secret-key' })
    expect(JSON.stringify(debugPayload)).not.toContain('secret-key')
  })

  it('is unavailable without a key, and in a browser build', async () => {
    vi.stubGlobal('window', {})
    await expect(openRouterProvider.listModels()).rejects.toThrow('API key required')
    await expect(openRouterProvider.health()).resolves.toBe(false)
    configureHostedKey('openrouter', { apiKey: 'secret-key' })
    await expect(openRouterProvider.listModels()).rejects.toThrow('desktop app')
  })

  it('offers only the Gemini models that generate text', async () => {
    configureHostedKey('gemini', { apiKey: 'secret-key' })
    const aiApiRequest = vi.fn().mockResolvedValue({
      status: 200,
      body: JSON.stringify({ data: [{ id: 'models/gemini-3-pro' }, { id: 'models/gemini-embedding-001' }, { id: 'models/imagen-4' }, { id: 'models/gemini-2.5-flash' }] }),
    })
    vi.stubGlobal('window', { desktop: { aiApiRequest } })

    await expect(geminiProvider.listModels()).resolves.toEqual(['gemini-2.5-flash', 'gemini-3-pro'])
    expect(aiApiRequest).toHaveBeenCalledWith(expect.objectContaining({ provider: 'gemini', path: '/models' }))
  })

  it('reads what an OpenRouter model can do from the catalogue', async () => {
    configureHostedKey('openrouter', { apiKey: 'secret-key' })
    vi.stubGlobal('window', {
      desktop: {
        aiApiRequest: vi.fn().mockResolvedValue({
          status: 200,
          body: JSON.stringify({
            data: [
              { id: 'vendor/seer', architecture: { input_modalities: ['text', 'image'] }, supported_parameters: ['tools', 'reasoning'] },
              { id: 'vendor/plain', architecture: { input_modalities: ['text'] }, supported_parameters: [] },
            ],
          }),
        }),
      },
    })

    await expect(openRouterProvider.listModels()).resolves.toEqual(['vendor/plain', 'vendor/seer'])
    expect(await openRouterProvider.supportsVision('vendor/seer')).toBe(true)
    expect(await openRouterProvider.supportsTools('vendor/seer')).toBe(true)
    expect(await openRouterProvider.supportsVision('vendor/plain')).toBe(false)
    expect(await openRouterProvider.supportsTools('vendor/plain')).toBe(false)
  })
})
