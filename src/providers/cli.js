import { ollamaProvider } from './ollama.js'

/**
 * Desktop clients (Codex, Claude Code) driven through the Electron bridge.
 *
 * The clients take one prompt and stream one answer: they have no message
 * list and no way to call a function that lives in this app. So the request
 * is flattened here — system prompt apart, the conversation as a transcript —
 * and the app's tools are offered as a text protocol. A call comes back as a
 * `<tool_call>` block, which Stream.js already recognises as a typed call and
 * runs through the ordinary tool loop; the next round carries the result in
 * the transcript.
 *
 * The bridge answers in the Ollama NDJSON shape, so the Ollama stream parser
 * reads it unchanged.
 */

const TOOL_CALL_OPEN = '<tool_call>'
const TOOL_CALL_CLOSE = '</tool_call>'

function desktopApi() {
  return typeof window !== 'undefined' ? window.desktop : null
}

function abortError() {
  return new DOMException('The operation was aborted', 'AbortError')
}

function formatToolCall(call) {
  const fn = call?.function ?? call ?? {}
  let args = fn.arguments ?? {}
  if (typeof args === 'string') {
    try { args = JSON.parse(args) } catch { /* keep the raw text */ }
  }
  return `${TOOL_CALL_OPEN}${JSON.stringify({ name: fn.name, arguments: args })}${TOOL_CALL_CLOSE}`
}

export function toolProtocolInstructions(tools) {
  const available = (tools || []).map(tool => tool?.function).filter(fn => fn?.name)
  if (available.length === 0) return ''
  const catalogue = available.map(fn => [
    `- ${fn.name}: ${String(fn.description || '').trim()}`,
    `  parameters: ${JSON.stringify(fn.parameters ?? { type: 'object', properties: {} })}`,
  ].join('\n')).join('\n')
  return [
    '# Tools',
    'You can use the tools below. They are run by the application, not by you: you have no other tool, shell or file access.',
    `To call a tool, write exactly one block in this form and then stop writing:`,
    `${TOOL_CALL_OPEN}{"name": "tool_name", "arguments": {"argument": "value"}}${TOOL_CALL_CLOSE}`,
    'The block must contain valid JSON. Nothing you write after it is delivered. The result comes back in the next message as a TOOL RESULT, and you then continue. Never write a TOOL RESULT yourself and never invent what a tool returned.',
    'When you do not need a tool, just write your answer, with no block at all.',
    '',
    'Available tools:',
    catalogue,
  ].join('\n')
}

function messageText(message) {
  return typeof message?.content === 'string' ? message.content : JSON.stringify(message?.content ?? '')
}

/**
 * The conversation as one prompt. Roles stay visible so the model can tell its
 * own earlier turns from everyone else's, and its own tool calls are written
 * back in the protocol it is asked to use.
 */
export function serializeTranscript(messages) {
  const entries = (Array.isArray(messages) ? messages : []).filter(message => message?.role !== 'system').map(message => {
    if (message.role === 'tool') {
      return `TOOL RESULT${message.tool_name ? ` (${message.tool_name})` : ''}:\n${messageText(message)}`
    }
    const calls = Array.isArray(message.tool_calls) ? message.tool_calls.map(formatToolCall) : []
    const body = [messageText(message), ...calls].filter(part => String(part).trim()).join('\n')
    return `${String(message.role || 'user').toUpperCase()}:\n${body}`
  })
  return [
    'Conversation so far:',
    '',
    entries.join('\n\n'),
    '',
    'Write the next ASSISTANT message now. Reply with the message text only, without the "ASSISTANT:" label.',
  ].join('\n')
}

/** `think` as Stream.js passes it: false is off, a level is a level, true or null is the client default. */
function effortFor(think) {
  if (think === false) return 'none'
  return typeof think === 'string' ? think : null
}

export function createCliProvider({ id, label }) {
  return {
    id,
    label,
    async capabilities() { return ['completion', 'tools', 'thinking'] },
    async supportsTools() { return true },
    async supportsThinking() { return true },
    // The prompt reaches the client as one flattened transcript: no image slot.
    async supportsVision() { return false },
    async health() {
      try {
        const status = await desktopApi()?.aiStatus?.(id)
        return Boolean(status?.authenticated)
      } catch {
        return false
      }
    },
    async listModels() {
      const api = desktopApi()
      if (!api?.aiListModels) throw new Error(`${label} is available only in the desktop app`)
      return api.aiListModels(id)
    },
    buildChatRequest({ model, messages, tools = null, think = null }) {
      const system = (messages || []).filter(message => message?.role === 'system').map(messageText).join('\n\n')
      const protocol = toolProtocolInstructions(tools)
      return {
        url: `cli://${id}/chat`,
        headers: {},
        body: {
          provider: id,
          model,
          system: [system, protocol].filter(Boolean).join('\n\n'),
          prompt: serializeTranscript(messages),
          effort: effortFor(think),
        },
      }
    },
    /**
     * Streams through the bridge. A finished `<tool_call>` block ends the
     * request on the spot: the call is all this round needed, and whatever the
     * model writes after it — often an invented result — is discarded anyway.
     */
    async sendChat(request, { signal } = {}) {
      const api = desktopApi()
      if (!api?.aiChatStream) throw new Error(`${label} is available only in the desktop app`)
      if (signal?.aborted) throw abortError()
      const requestId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
      const encoder = new TextEncoder()
      let controller
      let closed = false
      let started = false
      let content = ''
      let pending = ''
      const stream = new ReadableStream({ start(value) { controller = value } })

      return new Promise((resolve, reject) => {
        const cleanup = () => {
          signal?.removeEventListener('abort', abort)
          api.aiChatStreamCleanup?.(requestId)
        }
        const close = () => {
          if (closed) return
          closed = true
          controller.close()
          cleanup()
        }
        const fail = error => {
          if (closed) return
          closed = true
          if (started) controller.error(error)
          else reject(error)
          cleanup()
        }
        function abort() {
          void api.aiCancel?.(requestId)
          fail(abortError())
        }
        const begin = () => {
          if (started) return
          started = true
          resolve(new Response(stream, { status: 200, headers: { 'Content-Type': 'application/x-ndjson' } }))
        }
        const forward = chunk => {
          controller.enqueue(encoder.encode(chunk))
          pending += chunk
          const lines = pending.split('\n')
          pending = lines.pop() ?? ''
          for (const line of lines) {
            try { content += JSON.parse(line)?.message?.content ?? '' } catch { /* the parser reports it */ }
          }
          const open = content.lastIndexOf(TOOL_CALL_OPEN)
          if (open >= 0 && content.indexOf(TOOL_CALL_CLOSE, open) >= 0) {
            void api.aiCancel?.(requestId)
            controller.enqueue(encoder.encode(`${JSON.stringify({ done: true, done_reason: 'tool_call' })}\n`))
            close()
          }
        }

        signal?.addEventListener('abort', abort, { once: true })
        api.aiChatStream({ ...request.body, requestId }, event => {
          if (closed) return
          if (event.type === 'start') begin()
          else if (event.type === 'chunk') { begin(); forward(event.chunk) }
          else if (event.type === 'end') { begin(); close() }
          else if (event.type === 'error') fail(signal?.aborted ? abortError() : new Error(event.message))
        })
      })
    },
    createStreamParser: () => ollamaProvider.createStreamParser(),
  }
}
