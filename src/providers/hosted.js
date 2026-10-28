/**
 * The hosted providers reached through the desktop bridge: Ollama Cloud,
 * OpenRouter and Gemini.
 *
 * All three are an HTTP API behind an API key, and the key is the reason this
 * layer exists. It is stored and used by the main process, which is also the
 * only place that knows each provider's address, so the renderer asks for a
 * path and never holds a credential it could leak into a debug payload — or,
 * in a browser build, into a page. A key the user has just typed travels with
 * the request until it is saved, which is what makes "Connect" work before
 * anything is stored.
 */

/** Per provider: the key typed this session, and whether one is saved. */
const keyState = {}

export function configureHostedKey(providerId, { apiKey = '', stored = false } = {}) {
  keyState[providerId] = { apiKey: String(apiKey || '').trim(), stored: Boolean(stored) }
}

export function hostedKey(providerId) {
  return keyState[providerId]?.apiKey ?? ''
}

export function hasHostedKey(providerId) {
  const state = keyState[providerId]
  return Boolean(state?.apiKey || state?.stored)
}

function desktopApi() {
  return typeof window !== 'undefined' ? window.desktop : null
}

export function newRequestId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
}

export function abortError() {
  return new DOMException('The operation was aborted', 'AbortError')
}

/**
 * One request, answered in full. Rejects with the provider's own message when
 * it answered with an error status, so a wrong key reads as a wrong key.
 */
export async function hostedRequest(providerId, label, path, { method = 'GET', body = null, requestId = '' } = {}) {
  if (!hasHostedKey(providerId)) throw new Error(`${label} API key required`)
  const api = desktopApi()
  if (!api?.aiApiRequest) throw new Error(`${label} is available only in the desktop app`)
  const response = await api.aiApiRequest({ provider: providerId, path, method, body, apiKey: hostedKey(providerId), requestId })
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`HTTP ${response.status}${hostedErrorDetail(response.body) ? `: ${hostedErrorDetail(response.body)}` : ''}`)
  }
  return response.body
}

/**
 * The readable part of an error body. Ollama answers `{ error: "…" }`, the
 * OpenAI-compatible APIs `{ error: { message } }`, and Gemini sometimes wraps
 * that in an array.
 */
export function hostedErrorDetail(raw) {
  try {
    const parsed = JSON.parse(raw)
    const error = (Array.isArray(parsed) ? parsed[0] : parsed)?.error
    const message = typeof error === 'string' ? error : error?.message
    return String(message || raw).slice(0, 200)
  } catch {
    return String(raw || '').slice(0, 200)
  }
}

/**
 * A streamed chat as a `Response`, so the caller reads it exactly as it reads
 * a direct `fetch`. The bytes are the provider's own frames — NDJSON for
 * Ollama, Server-Sent Events for the OpenAI-compatible APIs — and the
 * provider's parser is what reads them.
 */
export function hostedStream(providerId, label, { path, body, contentType = 'application/x-ndjson' }, { signal } = {}) {
  if (signal?.aborted) throw abortError()
  const api = desktopApi()
  if (!api?.aiApiStream) throw new Error(`${label} is available only in the desktop app`)
  if (!hasHostedKey(providerId)) throw new Error(`${label} API key required`)
  const requestId = newRequestId()
  const abort = () => { void desktopApi()?.aiApiCancel?.(requestId) }
  signal?.addEventListener('abort', abort, { once: true })
  return new Promise((resolve, reject) => {
    let started = false
    let controller
    const stream = new ReadableStream({ start(value) { controller = value } })
    const cleanup = () => {
      signal?.removeEventListener('abort', abort)
      api.aiApiStreamCleanup?.(requestId)
    }
    api.aiApiStream({ provider: providerId, path, method: 'POST', body, apiKey: hostedKey(providerId), requestId }, event => {
      if (event.type === 'start') {
        started = true
        resolve(new Response(stream, { status: event.status, headers: { 'Content-Type': contentType } }))
      } else if (event.type === 'chunk') {
        controller.enqueue(new TextEncoder().encode(event.chunk))
      } else if (event.type === 'end') {
        controller.close()
        cleanup()
      } else if (event.type === 'error') {
        const error = signal?.aborted ? abortError() : new Error(event.message)
        if (started) controller.error(error)
        else reject(error)
        cleanup()
      }
    })
  })
}
