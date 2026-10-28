/**
 * The providers that speak the OpenAI chat API: OpenRouter and Gemini.
 *
 * Everything specific to that dialect lives here — the message shape, the
 * Server-Sent Events framing, where reasoning and tool calls arrive — and the
 * two providers differ only in the few details their factory passes in. The
 * request itself goes through the desktop bridge, like Ollama Cloud: the API
 * key stays in the main process.
 *
 * The events this parser emits are the ones the Ollama parser emits, so
 * Stream.js — the tool loop, the retries, the thinking channel — reads every
 * provider the same way.
 */

import { abortError, hasHostedKey, hostedErrorDetail, hostedStream } from './hosted.js'

// Statuses worth a second try: a rate limit, or a momentary upstream failure.
// Only before the first byte of the answer — text already shown cannot be
// withdrawn — which is exactly where this retry sits.
const TRANSIENT_STATUSES = [408, 409, 429, 500, 502, 503, 504]
const RETRY_DELAYS_MS = [1500, 4000]

/** JPEG and PNG are what the app's attachments and screenshots produce. */
function imageDataUrl(image) {
  const data = String(image || '')
  if (data.startsWith('data:')) return data
  return `data:${data.startsWith('/9j/') ? 'image/jpeg' : 'image/png'};base64,${data}`
}

/**
 * The conversation in OpenAI shape.
 *
 * Incoming messages are in the Ollama shape Stream.js builds: a tool call has
 * no id and its result is tied to it by name and position. An id is minted per
 * call here and carried into the result that follows it, which is what the
 * OpenAI API requires; a result with no call to belong to is handed over as
 * plain text rather than dropped.
 */
export function toOpenAiMessages(messages) {
  let pendingCallId = null
  let counter = 0
  return (Array.isArray(messages) ? messages : []).map(message => {
    if (message.role === 'tool') {
      const callId = pendingCallId
      pendingCallId = null
      if (callId) return { role: 'tool', tool_call_id: callId, content: String(message.content ?? '') }
      return { role: 'user', content: `[Result of ${message.tool_name || 'tool'}]\n${String(message.content ?? '')}` }
    }
    if (message.role === 'assistant' && message.tool_calls?.length) {
      const calls = message.tool_calls.map(call => {
        const args = call?.function?.arguments
        return {
          id: `call_${++counter}`,
          type: 'function',
          function: { name: String(call?.function?.name || ''), arguments: typeof args === 'string' ? args : JSON.stringify(args ?? {}) },
        }
      })
      pendingCallId = calls[0].id
      return { role: 'assistant', content: message.content || null, tool_calls: calls }
    }
    if (message.images?.length) {
      return {
        role: message.role,
        content: [
          ...(message.content ? [{ type: 'text', text: String(message.content) }] : []),
          ...message.images.map(image => ({ type: 'image_url', image_url: { url: imageDataUrl(image) } })),
        ],
      }
    }
    return { role: message.role, content: String(message.content ?? '') }
  })
}

/** Tools as the API accepts them: the app's own extra fields stay at home. */
function toOpenAiTools(tools) {
  return (Array.isArray(tools) ? tools : [])
    .map(tool => tool?.function)
    .filter(fn => fn?.name)
    .map(fn => ({
      type: 'function',
      function: { name: fn.name, description: String(fn.description || ''), parameters: fn.parameters ?? { type: 'object', properties: {} } },
    }))
}

/**
 * The app's reasoning level as this dialect names it.
 *
 * `none` sends no reasoning parameter at all — the model's own default —
 * because an explicit "off" is not something every model behind these APIs
 * accepts, and `max` is clamped to `high`, the ceiling they offer.
 */
export function openAiEffort(think) {
  if (think == null || think === false || think === true || think === 'none') return ''
  return think === 'max' ? 'high' : String(think)
}

/** The content of one SSE line, or '' for blank lines, comments and `[DONE]`. */
function ssePayload(line) {
  const text = line.trim()
  if (!text.startsWith('data:')) return ''
  const payload = text.slice(5).trim()
  return payload === '[DONE]' ? '' : payload
}

/**
 * Builds a provider around the dialect.
 *
 * `id`, `label` and `origin` identify it; `reasoningField` is how it takes the
 * effort (OpenRouter nests it, Gemini has a flat field); `listModels` and
 * `modelCapabilities` are the parts no two of these APIs share.
 */
export function createOpenAiCompatibleProvider({
  id,
  label,
  origin,
  reasoningField = 'reasoning',
  usage = { usage: { include: true } },
  listModels,
  modelCapabilities,
}) {
  const reasoningPayload = effort => {
    if (!effort) return {}
    return reasoningField === 'reasoning_effort' ? { reasoning_effort: effort } : { reasoning: { effort } }
  }

  return {
    id,
    label,

    async capabilities(_baseUrl, model) {
      return modelCapabilities(model)
    },
    async supportsTools(model) {
      return (await modelCapabilities(model)).includes('tools')
    },
    async supportsThinking(model) {
      return (await modelCapabilities(model)).includes('thinking')
    },
    async supportsVision(model) {
      return (await modelCapabilities(model)).includes('vision')
    },
    async listModels() {
      return listModels()
    },
    async health() {
      if (!hasHostedKey(id)) return false
      try {
        await listModels()
        return true
      } catch {
        return false
      }
    },

    buildChatRequest({ model, messages, tools = null, think = null, options = {} }) {
      const tooling = toOpenAiTools(tools)
      return {
        url: `${origin}/chat/completions`,
        headers: { 'Content-Type': 'application/json' },
        body: {
          model,
          messages: toOpenAiMessages(messages),
          stream: true,
          ...(tooling.length ? { tools: tooling } : {}),
          ...reasoningPayload(openAiEffort(think)),
          ...(options.temperature != null ? { temperature: options.temperature } : {}),
          ...(options.numPredict != null ? { max_tokens: options.numPredict } : {}),
          ...usage,
        },
      }
    },

    /**
     * Sends through the bridge, with one retry on a rate limit or a momentary
     * upstream failure. A status that is not transient is handed back as the
     * response it is: Stream.js reads the body and reports what the provider
     * said, which is how a wrong key or an unknown model stays readable.
     */
    async sendChat(request, { signal } = {}) {
      for (let attempt = 0; ; attempt += 1) {
        const response = await hostedStream(id, label, { path: '/chat/completions', body: request.body, contentType: 'text/event-stream' }, { signal })
        if (response.ok || !TRANSIENT_STATUSES.includes(response.status) || attempt >= RETRY_DELAYS_MS.length) return response
        const body = await response.text().catch(() => '')
        console.warn(`[${id}] HTTP ${response.status} — retrying in ${RETRY_DELAYS_MS[attempt]}ms: ${hostedErrorDetail(body)}`)
        await new Promise((resolve, reject) => {
          if (signal?.aborted) return reject(abortError())
          const timer = setTimeout(resolve, RETRY_DELAYS_MS[attempt])
          signal?.addEventListener('abort', () => { clearTimeout(timer); reject(abortError()) }, { once: true })
        })
      }
    },

    /**
     * Server-Sent Events into the app's own events.
     *
     * Text arrives in `delta.content`, reasoning in `delta.reasoning` (or
     * `delta.reasoning_content`), and a tool call in fragments: the name and
     * the JSON arguments have to be reassembled before the call can be
     * reported, so it is emitted once the stream says the turn is over.
     */
    createStreamParser() {
      let buffer = ''
      let call = null
      let finished = false

      const finish = (events, doneReason) => {
        if (finished) return
        finished = true
        if (call?.name) {
          let args = {}
          try { args = call.arguments.trim() ? JSON.parse(call.arguments) : {} } catch { args = {} }
          events.push({ type: 'toolCalls', toolCalls: [{ function: { name: call.name, arguments: args } }] })
        }
        events.push({ type: 'done', content: '', doneReason: doneReason ?? null })
      }

      const handle = (payload, events) => {
        let chunk
        try {
          chunk = JSON.parse(payload)
        } catch {
          events.push({ type: 'malformed', line: payload })
          return
        }
        // An error that arrived inside a 200 answer: usually the model's own
        // upstream provider failing part way through.
        if (chunk.error) {
          events.push({ type: 'error', message: String(chunk.error.message || chunk.error) })
          return
        }
        const choice = chunk.choices?.[0]
        const delta = choice?.delta
        if (delta) {
          const reasoning = delta.reasoning ?? delta.reasoning_content
          if (reasoning) events.push({ type: 'thinking', text: String(reasoning) })
          if (delta.content) events.push({ type: 'delta', text: String(delta.content) })
          for (const part of delta.tool_calls || []) {
            if ((part.index ?? 0) !== 0 || call?.closed) continue
            // Gemini numbers parallel calls all at index 0, so the index alone
            // does not say where one call ends: a fragment with a different id,
            // or a new name after the arguments have started, is the next call.
            // Only the first is kept — one call per message, which is what the
            // tool loop runs anyway — while a name split across fragments, id
            // and all, still joins up.
            if (call && ((part.id && call.id && part.id !== call.id) || (part.function?.name && call.arguments))) {
              call.closed = true
              continue
            }
            call ??= { id: part.id ?? null, name: '', arguments: '' }
            if (part.function?.name) call.name += part.function.name
            if (part.function?.arguments) call.arguments += part.function.arguments
          }
        }
        if (choice?.finish_reason) finish(events, choice.finish_reason)
      }

      return {
        push(chunk) {
          const events = []
          buffer += chunk
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''
          for (const line of lines) {
            const payload = ssePayload(line)
            if (payload) handle(payload, events)
          }
          return events
        },
        flush() {
          const events = []
          const payload = ssePayload(buffer)
          buffer = ''
          if (payload) handle(payload, events)
          // A stream that ended without a finish reason still ended: the turn
          // is reported, with the tool call it had collected.
          finish(events, null)
          return events
        },
      }
    },
  }
}
