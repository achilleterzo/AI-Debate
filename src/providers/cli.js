function desktopApi() {
  return typeof window !== 'undefined' ? window.desktop : null
}

function streamParser() {
  let buffer = ''
  const parse = line => {
    if (!line.trim()) return []
    try {
      const value = JSON.parse(line)
      if (value.error) return [{ type: 'error', message: String(value.error) }]
      return [
        ...(value.message?.content ? [{ type: 'delta', text: value.message.content }] : []),
        ...(value.done ? [{ type: 'done', content: value.message?.content ?? '', doneReason: value.done_reason ?? null }] : []),
      ]
    } catch {
      return [{ type: 'malformed', line }]
    }
  }
  return {
    push(chunk) {
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      return lines.flatMap(parse)
    },
    flush() {
      const rest = buffer
      buffer = ''
      return parse(rest)
    },
  }
}

export function createCliProvider({ id, label }) {
  return {
    id,
    label,
    async capabilities() { return [] },
    async supportsTools() { return false },
    async supportsThinking() { return false },
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
    buildChatRequest({ model, messages }) {
      return { url: `cli://${id}/chat`, headers: {}, body: { provider: id, model, messages } }
    },
    async sendChat(request, { signal } = {}) {
      const api = desktopApi()
      if (!api?.aiChat) throw new Error(`${label} is available only in the desktop app`)
      if (signal?.aborted) throw new DOMException('The operation was aborted', 'AbortError')
      const requestId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
      const abort = () => { void api.aiCancel?.(requestId) }
      signal?.addEventListener('abort', abort, { once: true })
      let content
      try { content = await api.aiChat({ ...request.body, requestId }) } finally { signal?.removeEventListener('abort', abort) }
      if (signal?.aborted) throw new DOMException('The operation was aborted', 'AbortError')
      const line = JSON.stringify({ message: { role: 'assistant', content: String(content || '') }, done: true }) + '\n'
      return new Response(line, { status: 200, headers: { 'Content-Type': 'application/x-ndjson' } })
    },
    createStreamParser: streamParser,
  }
}
