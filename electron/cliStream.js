/**
 * Translates what the Claude and Codex clients print into the NDJSON chat
 * stream the renderer already parses for Ollama: `{ message: { content } }`,
 * `{ message: { thinking } }`, `{ done: true }` and `{ error }` lines.
 *
 * Kept apart from main.js and free of Electron imports so the translation —
 * the part that decides what the user sees stream into a balloon — can be
 * tested without spawning a client.
 */

export function ndjson(value) {
  return `${JSON.stringify(value)}\n`
}

/**
 * The app's reasoning levels as each client names them.
 *
 * Claude has no "off" through the CLI, so `none` asks for the least effort it
 * accepts. Codex lists what every model supports; the level is moved to the
 * nearest one the model offers instead of being sent as a value it rejects.
 */
const CLAUDE_EFFORTS = { none: 'low', low: 'low', medium: 'medium', high: 'high', max: 'max' }
const CODEX_PREFERENCES = {
  none: ['none', 'minimal', 'low'],
  low: ['low', 'minimal', 'medium'],
  medium: ['medium', 'low', 'high'],
  high: ['high', 'medium', 'xhigh'],
  max: ['xhigh', 'high', 'medium'],
}

export function claudeEffort(level) {
  return CLAUDE_EFFORTS[level] ?? null
}

export function codexEffort(level, supported = null) {
  const preferences = CODEX_PREFERENCES[level]
  if (!preferences) return null
  if (!Array.isArray(supported) || supported.length === 0) return level === 'none' ? 'minimal' : level === 'max' ? 'high' : level
  return preferences.find(effort => supported.includes(effort)) ?? null
}

/**
 * `claude -p --output-format stream-json --include-partial-messages`.
 *
 * Text and thinking arrive as `content_block_delta` stream events. The whole
 * assistant message and the final `result` repeat the same text, so they only
 * count when no delta carried it — a client that did not stream still answers.
 */
export function createClaudeTranslator() {
  let streamedText = false
  let fallbackText = ''

  return {
    push(event) {
      if (!event || typeof event !== 'object') return []
      if (event.type === 'stream_event') {
        const delta = event.event?.type === 'content_block_delta' ? event.event.delta : null
        if (delta?.type === 'text_delta' && delta.text) {
          streamedText = true
          return [ndjson({ message: { role: 'assistant', content: delta.text } })]
        }
        if (delta?.type === 'thinking_delta' && delta.thinking) {
          return [ndjson({ message: { role: 'assistant', thinking: delta.thinking } })]
        }
        return []
      }
      if (event.type === 'assistant' && !streamedText) {
        const text = (event.message?.content || [])
          .filter(block => block?.type === 'text' && typeof block.text === 'string')
          .map(block => block.text)
          .join('')
        if (text) fallbackText = text
        return []
      }
      if (event.type === 'result') {
        if (event.is_error || (event.subtype && event.subtype !== 'success')) {
          return [ndjson({ error: String(event.result || event.error || event.subtype || 'Claude returned an error') })]
        }
        const text = streamedText ? '' : String(event.result || fallbackText || '')
        return [
          ...(text ? [ndjson({ message: { role: 'assistant', content: text } })] : []),
          ndjson({ done: true, done_reason: event.stop_reason ?? null }),
        ]
      }
      return []
    },
  }
}

/**
 * Notifications from `codex app-server` for one turn.
 *
 * `finished` is set once the turn ended one way or the other: the process has
 * nothing more to say about this request and can be stopped.
 */
export function createCodexTranslator() {
  const streamedItems = new Set()
  let lastAgentItem = null
  let wroteText = false
  let lastReasoningItem = null

  const text = (itemId, value) => {
    const separator = wroteText && lastAgentItem && lastAgentItem !== itemId ? '\n\n' : ''
    lastAgentItem = itemId
    wroteText = true
    streamedItems.add(itemId)
    return ndjson({ message: { role: 'assistant', content: `${separator}${value}` } })
  }

  return {
    finished: false,
    notification(message) {
      const params = message?.params || {}
      switch (message?.method) {
        case 'item/agentMessage/delta':
          return params.delta ? [text(params.itemId, params.delta)] : []
        case 'item/reasoning/summaryTextDelta':
        case 'item/reasoning/textDelta': {
          if (!params.delta) return []
          const separator = lastReasoningItem && lastReasoningItem !== params.itemId ? '\n\n' : ''
          lastReasoningItem = params.itemId
          return [ndjson({ message: { role: 'assistant', thinking: `${separator}${params.delta}` } })]
        }
        case 'item/reasoning/summaryPartAdded':
          return lastReasoningItem ? [ndjson({ message: { role: 'assistant', thinking: '\n\n' } })] : []
        case 'item/completed': {
          const item = params.item
          if (item?.type === 'agentMessage' && item.text && !streamedItems.has(item.id)) return [text(item.id, item.text)]
          return []
        }
        case 'error':
          if (params.willRetry) return []
          this.finished = true
          return [ndjson({ error: params.error?.message || 'OpenAI returned an error' })]
        case 'turn/completed': {
          this.finished = true
          const turn = params.turn || {}
          if (turn.status === 'failed') return [ndjson({ error: turn.error?.message || 'OpenAI turn failed' })]
          if (turn.status === 'interrupted') return [ndjson({ error: 'OpenAI turn interrupted' })]
          return [ndjson({ done: true, done_reason: turn.status ?? null })]
        }
        default:
          return []
      }
    },
  }
}
