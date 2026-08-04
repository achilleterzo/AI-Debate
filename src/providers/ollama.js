/**
 * Ollama adapter.
 *
 * Owns everything that is specific to the Ollama HTTP API: endpoint paths,
 * request shape and the NDJSON stream format. Orchestration — retries, the
 * tool loop, timeouts, context compaction — deliberately stays in Stream.js,
 * so adding a second provider costs one file instead of a refactor.
 */

// Models known to choke when a `tools` array is present in the request.
const TOOL_UNSUPPORTED_TOKENS = ['deepseek', 'minimax']

const HEALTH_TIMEOUT_MS = 5000

function parseLine(line, events) {
  const trimmed = line.trim()
  if (!trimmed) return

  let json
  try {
    json = JSON.parse(trimmed)
  } catch {
    events.push({ type: 'malformed', line: trimmed })
    return
  }

  // A provider-reported error ends the meaningful content of this line.
  if (json.error) {
    events.push({ type: 'error', message: String(json.error) })
    return
  }

  if (json.message?.thinking) {
    events.push({ type: 'thinking', text: json.message.thinking })
  }
  if (json.message?.tool_calls?.length) {
    events.push({ type: 'toolCalls', toolCalls: json.message.tool_calls })
  }
  if (json.message?.content) {
    events.push({ type: 'delta', text: json.message.content })
  }
  if (json.done) {
    events.push({ type: 'done', content: json.message?.content ?? '', doneReason: json.done_reason ?? null })
  }
}

export const ollamaProvider = {
  id: 'ollama',
  label: 'Ollama',

  supportsTools(model) {
    const name = String(model || '').toLowerCase()
    return !TOOL_UNSUPPORTED_TOKENS.some(token => name.includes(token))
  },

  async listModels(baseUrl, { signal } = {}) {
    const response = await fetch(`${baseUrl}/api/tags`, { signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    return data.models?.map(model => model.name) ?? []
  },

  /** Never throws: an unreachable endpoint is a `false`, not an exception. */
  async health(baseUrl, { timeoutMs = HEALTH_TIMEOUT_MS } = {}) {
    try {
      const response = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(timeoutMs) })
      return response.ok
    } catch {
      return false
    }
  },

  buildChatRequest({ baseUrl, model, messages, tools = null, think = null }) {
    return {
      url: `${baseUrl}/api/chat`,
      headers: { 'Content-Type': 'application/json' },
      body: {
        model,
        messages,
        stream: true,
        ...(tools ? { tools } : {}),
        ...(think != null ? { think } : {}),
      },
    }
  },

  /**
   * Turns raw response chunks into normalized events. Chunk boundaries do not
   * respect line boundaries, so an incomplete trailing line is buffered until
   * the rest of it arrives; `flush()` drains whatever is left at stream end.
   */
  createStreamParser() {
    let buffer = ''

    return {
      push(chunk) {
        const events = []
        buffer += chunk
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) parseLine(line, events)
        return events
      },
      flush() {
        const events = []
        const rest = buffer
        buffer = ''
        parseLine(rest, events)
        return events
      },
    }
  },
}
