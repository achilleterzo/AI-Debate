import { afterEach, describe, expect, it, vi } from 'vitest'
import { claudeProvider } from '../src/providers/claude.js'
import { openaiProvider } from '../src/providers/openai.js'
import { serializeTranscript, toolProtocolInstructions } from '../src/providers/cli.js'
import { getProvider, setActiveProviderId } from '../src/providers/index.js'
import { streamChat } from '../src/debate/Stream'
import { extractPseudoToolCalls } from '../src/prompts/PseudoToolCalls'
import { ROLL_DICE_TOOL } from '../src/tools/DiceTool'

afterEach(() => {
  vi.unstubAllGlobals()
  setActiveProviderId('ollama')
})

const line = value => `${JSON.stringify(value)}\n`

/**
 * A desktop bridge that plays one scripted answer per request, as the main
 * process would: start, NDJSON chunks, end.
 */
function scriptedDesktop(answers) {
  const requests = []
  const desktop = {
    aiListModels: vi.fn().mockResolvedValue(['gpt-test']),
    aiCancel: vi.fn(),
    aiChatStreamCleanup: vi.fn(),
    aiChatStream: vi.fn((request, onEvent) => {
      requests.push(request)
      const script = answers[requests.length - 1] ?? []
      queueMicrotask(() => {
        onEvent({ type: 'start', status: 200 })
        for (const chunk of script) onEvent(typeof chunk === 'string' ? { type: 'chunk', chunk } : chunk)
        onEvent({ type: 'end' })
      })
    }),
  }
  return { desktop, requests }
}

async function readEvents(provider, response) {
  const parser = provider.createStreamParser()
  return [...parser.push(await response.text()), ...parser.flush()]
}

describe('desktop CLI providers', () => {
  it('registers OpenAI and Claude as selectable providers', () => {
    setActiveProviderId('openai')
    expect(getProvider()).toBe(openaiProvider)
    setActiveProviderId('claude')
    expect(getProvider()).toBe(claudeProvider)
  })

  it('declares tools and thinking, which the clients now carry', async () => {
    expect(await openaiProvider.supportsTools('gpt-test')).toBe(true)
    expect(await claudeProvider.supportsThinking('sonnet')).toBe(true)
    expect(await claudeProvider.capabilities()).toEqual(expect.arrayContaining(['tools', 'thinking']))
  })

  it('streams the answer as it arrives, thinking kept apart from content', async () => {
    const { desktop } = scriptedDesktop([[
      line({ message: { thinking: 'Weighing it.' } }),
      line({ message: { content: 'Hello' } }),
      line({ message: { content: ', world' } }),
      line({ done: true }),
    ]])
    vi.stubGlobal('window', { desktop })

    const request = openaiProvider.buildChatRequest({ model: 'gpt-test', messages: [{ role: 'user', content: 'Hi' }] })
    const events = await readEvents(openaiProvider, await openaiProvider.sendChat(request))

    expect(events).toEqual([
      { type: 'thinking', text: 'Weighing it.' },
      { type: 'delta', text: 'Hello' },
      { type: 'delta', text: ', world' },
      { type: 'done', content: '', doneReason: null },
    ])
    expect(desktop.aiChatStream).toHaveBeenCalledWith(expect.objectContaining({ provider: 'openai', model: 'gpt-test', requestId: expect.any(String) }), expect.any(Function))
  })

  it('sends the system prompt apart from the transcript, with the reasoning level', () => {
    const request = claudeProvider.buildChatRequest({
      model: 'sonnet',
      messages: [{ role: 'system', content: 'You are Ada.' }, { role: 'user', content: 'Open the debate.' }],
      tools: [ROLL_DICE_TOOL],
      think: 'high',
    })
    expect(request.body.system).toMatch(/^You are Ada\./)
    expect(request.body.system).toContain('roll_dice')
    expect(request.body.prompt).toContain('USER:\nOpen the debate.')
    expect(request.body.prompt).not.toContain('You are Ada.')
    expect(request.body.effort).toBe('high')
    expect(claudeProvider.buildChatRequest({ model: 'sonnet', messages: [], think: false }).body.effort).toBe('none')
    expect(claudeProvider.buildChatRequest({ model: 'sonnet', messages: [] }).body.system).not.toContain('# Tools')
  })

  it('ends the request as soon as a tool call is complete', async () => {
    const { desktop } = scriptedDesktop([[
      line({ message: { content: 'Let me roll. <tool_call>{"name": "roll_dice", ' } }),
      line({ message: { content: '"arguments": {"count": 1, "sides": 20}}</tool_call>' } }),
      line({ message: { content: 'TOOL RESULT: 20, a critical hit!' } }),
    ]])
    vi.stubGlobal('window', { desktop })

    const request = claudeProvider.buildChatRequest({ model: 'sonnet', messages: [{ role: 'user', content: 'Roll' }], tools: [ROLL_DICE_TOOL] })
    const events = await readEvents(claudeProvider, await claudeProvider.sendChat(request))
    const text = events.filter(event => event.type === 'delta').map(event => event.text).join('')

    expect(text).not.toContain('critical hit')
    expect(events.at(-1)).toMatchObject({ type: 'done', doneReason: 'tool_call' })
    expect(desktop.aiCancel).toHaveBeenCalled()
  })

  it('reports native providers as unavailable in a browser build', async () => {
    vi.stubGlobal('window', {})
    await expect(claudeProvider.listModels()).rejects.toThrow('desktop app')
    await expect(claudeProvider.health()).resolves.toBe(false)
  })

  it('propagates a client error raised before the answer starts', async () => {
    vi.stubGlobal('window', {
      desktop: {
        aiChatStream: (_, onEvent) => queueMicrotask(() => onEvent({ type: 'error', message: 'Failed to authenticate: OAuth session expired' })),
        aiChatStreamCleanup: vi.fn(),
        aiCancel: vi.fn(),
      },
    })
    const request = claudeProvider.buildChatRequest({ model: 'sonnet', messages: [{ role: 'user', content: 'Hello' }] })
    await expect(claudeProvider.sendChat(request)).rejects.toThrow('OAuth session expired')
  })

  it('turns an error reported mid-answer into a stream error event', async () => {
    const { desktop } = scriptedDesktop([[line({ message: { content: 'Half' } }), line({ error: 'rate limited' })]])
    vi.stubGlobal('window', { desktop })
    const request = openaiProvider.buildChatRequest({ model: 'gpt-test', messages: [] })
    const events = await readEvents(openaiProvider, await openaiProvider.sendChat(request))
    expect(events).toContainEqual({ type: 'error', message: 'rate limited' })
  })

  it('cancels the client when the turn is aborted', async () => {
    const desktop = { aiChatStream: vi.fn(), aiChatStreamCleanup: vi.fn(), aiCancel: vi.fn() }
    vi.stubGlobal('window', { desktop })
    const controller = new AbortController()
    const request = openaiProvider.buildChatRequest({ model: 'gpt-test', messages: [] })
    const pending = openaiProvider.sendChat(request, { signal: controller.signal })
    controller.abort()
    await expect(pending).rejects.toThrow(/aborted/)
    expect(desktop.aiCancel).toHaveBeenCalled()
  })
})

describe('the text tool protocol', () => {
  it('is read back by the typed-call recogniser as one real call', () => {
    const answer = 'Rolling now.\n<tool_call>{"name": "roll_dice", "arguments": {"count": 2, "sides": 6}}</tool_call>'
    const calls = extractPseudoToolCalls(answer, [ROLL_DICE_TOOL])
    expect(calls).toHaveLength(1)
    expect(calls[0].function).toEqual({ name: 'roll_dice', arguments: { count: 2, sides: 6 } })
  })

  it('writes earlier calls and their results back into the transcript', () => {
    const prompt = serializeTranscript([
      { role: 'system', content: 'ignored here' },
      { role: 'user', content: 'Roll for it.' },
      { role: 'assistant', content: 'Rolling.', tool_calls: [{ function: { name: 'roll_dice', arguments: { count: 1, sides: 20 } } }] },
      { role: 'tool', tool_name: 'roll_dice', content: '17' },
    ])
    expect(prompt).not.toContain('ignored here')
    expect(prompt).toContain('ASSISTANT:\nRolling.\n<tool_call>{"name":"roll_dice","arguments":{"count":1,"sides":20}}</tool_call>')
    expect(prompt).toContain('TOOL RESULT (roll_dice):\n17')
  })

  it('offers nothing when the request carries no tools', () => {
    expect(toolProtocolInstructions([])).toBe('')
    expect(toolProtocolInstructions(null)).toBe('')
  })

  it('runs a whole tool round through streamChat', async () => {
    const { desktop, requests } = scriptedDesktop([
      [line({ message: { content: '<tool_call>{"name": "roll_dice", "arguments": {"count": 1, "sides": 20}}</tool_call>' } })],
      [line({ message: { content: 'I rolled a 17 and ' } }), line({ message: { content: 'the door opens.' } }), line({ done: true })],
    ])
    vi.stubGlobal('window', { desktop })
    const executeTool = vi.fn(async () => 'Rolled 1d20: 17')
    const tokens = []

    const result = await streamChat({
      model: 'sonnet',
      provider: claudeProvider,
      messages: [{ role: 'user', content: 'Try the door.' }],
      useTools: true,
      tools: [ROLL_DICE_TOOL],
      executeTool,
      onToken: token => tokens.push(token),
    })

    expect(executeTool).toHaveBeenCalledWith('roll_dice', { count: 1, sides: 20 })
    expect(requests).toHaveLength(2)
    expect(requests[1].prompt).toContain('TOOL RESULT (roll_dice):\nRolled 1d20: 17')
    expect(result).toBe('I rolled a 17 and the door opens.')
    // Streamed: the balloon saw the answer grow, not only the finished text.
    expect(tokens).toContain('I rolled a 17 and')
  })
})
