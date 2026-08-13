import { describe, expect, it, vi, afterEach, beforeAll } from 'vitest'
import { StreamAbortedError, abortActiveStreams, streamChat } from '../src/debate/Stream'
import { ollamaProvider } from '../src/providers/ollama'

// Same warm-up as the other stream tests: the capability listing is replayed
// once so it never lands in a test's fetch mock.
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

/** A response that streams one chunk and then stays open until the signal fires. */
function mockOpenStream() {
  return vi.fn(async (url, init) => ({
    ok: true,
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(JSON.stringify({ message: { content: 'Starting to answer' } }) + '\n'))
        init.signal.addEventListener('abort', () => {
          controller.error(Object.assign(new Error('aborted'), { name: 'AbortError' }))
        })
      },
    }),
  }))
}

describe('cutting a turn that is still speaking', () => {
  it('ends the request instead of waiting for the model to finish', async () => {
    vi.stubGlobal('fetch', mockOpenStream())

    const attempt = streamChat({
      baseUrl: 'http://fake',
      model: 'test-model',
      messages: [{ role: 'user', content: 'speak at length' }],
      // The first token is proof the answer is under way; cutting it there is
      // what the button does while the model is mid-sentence.
      onToken: () => abortActiveStreams(),
    })

    await expect(attempt).rejects.toBeInstanceOf(StreamAbortedError)
  })

  // A timeout aborts through the very same signal, and the two must not be
  // confused: one is a failure the chat should report, the other is the user.
  it('is not reported as the timeout that shares its signal', async () => {
    vi.stubGlobal('fetch', mockOpenStream())

    const attempt = streamChat({
      baseUrl: 'http://fake',
      model: 'test-model',
      messages: [{ role: 'user', content: 'speak at length' }],
      timeoutMs: 20,
      onToken: () => {},
    })

    await expect(attempt).rejects.toThrow(/Timeout/)
  })

  it('opens no further request once the run is stopping', async () => {
    const fetchMock = mockOpenStream()
    vi.stubGlobal('fetch', fetchMock)
    const stopRef = { current: true }

    await expect(streamChat({
      baseUrl: 'http://fake',
      model: 'test-model',
      messages: [{ role: 'user', content: 'speak' }],
      stopRef,
      onToken: () => {},
    })).rejects.toBeInstanceOf(StreamAbortedError)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('leaves later requests alone: the abort ends what was open, nothing more', async () => {
    abortActiveStreams()
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(JSON.stringify({ message: { content: 'A whole answer' }, done: true }) + '\n'))
          controller.close()
        },
      }),
    })))

    await expect(streamChat({
      baseUrl: 'http://fake',
      model: 'test-model',
      messages: [{ role: 'user', content: 'start again' }],
      onToken: () => {},
    })).resolves.toBe('A whole answer')
  })
})
