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

describe('streamChat empty response handling', () => {
  it('retries once when the model returns an empty response, then returns the retried content', async () => {
    const fetchMock = mockEmptyThenContentFetch(['', 'hello after retry'])
    vi.stubGlobal('fetch', fetchMock)

    const tokens = []
    const result = await streamChat({
      baseUrl: 'http://fake',
      model: 'test-model',
      messages: [{ ollamaRole: 'user', content: 'hi' }],
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
      messages: [{ ollamaRole: 'user', content: 'hi' }],
      systemPrompt: 'sys',
      useTools: false,
      onToken: () => {},
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result).toBe('')
  })
})
