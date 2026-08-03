import { Web } from '../services/Web'
import { getProvider } from '../providers/index.js'
import { LLM_TOOLS } from '../tools'

function trimText(txt, maxChars) {
  const s = String(txt || '')
  if (s.length <= maxChars) return s
  return s.slice(0, Math.max(0, maxChars - 28)) + '\n\n...[truncated for context]'
}

function compactMessages(arr, { keepLast = Infinity, maxPerMsg = 12000 } = {}) {
  const out = []
  const sys = arr.find(message => message.role === 'system')
  if (sys) out.push({ ...sys, content: trimText(sys.content, maxPerMsg) })
  const nonSystem = arr.filter(message => message.role !== 'system')
  const recent = Number.isFinite(keepLast) ? nonSystem.slice(-keepLast) : nonSystem
  const summary = nonSystem.find(message => String(message.content || '').startsWith('[Conversation summary so far]\n'))
  const selected = summary && !recent.includes(summary) ? [summary, ...recent] : recent
  const tail = selected.map(message => ({ ...message, content: trimText(message.content, maxPerMsg) }))
  return [...out, ...tail]
}

function cleanVisibleText(text) {
  let visible = String(text || '').replace(/<think>[\s\S]*?<\/think>/g, '').trimStart()
  visible = visible.replace(/<\|tool[▁_]calls[▁_]begin\|>[\s\S]*?<\|tool[▁_]calls[▁_]end\|>/g, '').trimEnd()
  return visible.replace(/<\|tool[▁_]calls[▁_]begin\|>[\s\S]*/g, '').trimEnd()
}

function cleanToolContinuationText(text, previousSegment = '') {
  let visible = cleanVisibleText(text)
  const previous = cleanVisibleText(previousSegment)
  if (previous && visible === previous) return ''
  if (previous && visible.startsWith(previous)) visible = visible.slice(previous.length).trimStart()
  // Some tool-capable models finish a leaked JSON argument on the next round.
  if (visible && [...visible].every(char => '{}[],'.includes(char) || /\s/.test(char))) return ''
  return visible
}

function parseInlineToolArguments(raw) {
  const args = {}
  for (const part of String(raw || '').split(',')) {
    const separator = part.indexOf('=')
    if (separator < 1) continue
    const key = part.slice(0, separator).trim()
    const value = part.slice(separator + 1).trim()
    if (!key || !value) continue
    try {
      args[key] = JSON.parse(value)
    } catch {
      args[key] = value.replace(/^['"]|['"]$/g, '')
    }
  }
  return args
}

function stripInlineToolSyntax(text, tools = []) {
  const names = new Set((tools || []).map(tool => tool?.function?.name).filter(Boolean))
  if (names.size === 0) return text
  return String(text || '')
    .replace(/\b([A-Za-z_]\w*)\s*\([^()\n]*\)/g, (match, fnName) => names.has(fnName) ? '' : match)
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export async function streamChat({
  baseUrl,
  model,
  messages,
  onToken,
  timeoutMs = 120_000,
  systemPrompt = null,
  useTools = false,
  tools = LLM_TOOLS,
  onPayload = null,
  onResponse = null,
  onEstimate = null,
  noResultsMessage = query => `No results for: ${query}`,
  sourceUrls = [],
  executeTool = null,
  onToolInvocation = null,
  onToolRound = null,
  provider = getProvider(),
}) {
  const label = `[${provider.id}] ${model}`
  console.group(label)

  let apiMessages = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, ...messages.map(message => ({ role: message.role, content: message.content }))]
    : messages.map(message => ({ role: message.role, content: message.content }))

  const MAX_TOOL_ROUNDS = 2
  let toolRound = 0
  let retried = false
  let retriedTooLong = false
  let retriedServerError = false
  let visiblePrefix = ''
  let previousToolSegment = ''
  const supportsTools = provider.supportsTools(model)
  const separateToolRounds = typeof onToolRound === 'function'

  while (true) {
    const payloadMessages = compactMessages(apiMessages, { maxPerMsg: 18000 })
    const totalChars = payloadMessages.reduce((count, message) => count + String(message.content || '').length, 0)
    const estimatedTokens = Math.ceil(totalChars / 4)
    if (typeof onEstimate === 'function') {
      onEstimate({ model, messageCount: payloadMessages.length, totalChars, estimatedTokens })
    }
    if (payloadMessages.length !== apiMessages.length || payloadMessages.some((message, index) => message.content !== (apiMessages[index]?.content ?? ''))) {
      console.warn(`${label} payload compattato prima dell'invio (context guard)`)
    }
    const controller = new AbortController()
    const timer = setTimeout(() => {
      console.warn(`${label} timeout dopo ${timeoutMs / 1000}s — abort`)
      controller.abort()
    }, timeoutMs)

    const wantsTools = useTools && supportsTools && toolRound < MAX_TOOL_ROUNDS && !retried
    const request = provider.buildChatRequest({
      baseUrl,
      model,
      messages: payloadMessages,
      tools: wantsTools ? tools : null,
    })
    const debugRequest = {
      provider: provider.id,
      url: request.url,
      method: 'POST',
      headers: request.headers,
      body: request.body,
    }
    console.log('→ payload', debugRequest)
    if (onPayload) onPayload(debugRequest)

    let res
    try {
      res = await fetch(request.url, {
        method: 'POST',
        signal: controller.signal,
        headers: request.headers,
        body: JSON.stringify(request.body),
      })
    } catch (err) {
      clearTimeout(timer)
      onResponse?.({ request: debugRequest, response: { error: err.message } })
      console.error(`${label} fetch error:`, err)
      console.groupEnd()
      throw err.name === 'AbortError'
        ? new Error(`Timeout: nessuna risposta da ${model} dopo ${timeoutMs / 1000}s`)
        : err
    }

    if (!res.ok) {
      clearTimeout(timer)
      const body = await res.text().catch(() => '')
      onResponse?.({ request: debugRequest, response: { status: res.status, body } })
      if (res.status >= 500 && res.status < 600 && !retriedServerError) {
        retriedServerError = true
        const jitterMs = 350 + Math.floor(Math.random() * 500)
        console.warn(`${label} HTTP ${res.status} transient server error — retry in ${jitterMs}ms`)
        await new Promise(resolve => setTimeout(resolve, jitterMs))
        continue
      }
      if (res.status === 400 && /prompt too long|max context length|context length/i.test(body) && !retriedTooLong) {
        retriedTooLong = true
        console.warn(`${label} prompt troppo lungo — retry con contesto ridotto`)
        apiMessages = compactMessages(apiMessages, { keepLast: 1, maxPerMsg: 6000 })
        continue
      }
      console.error(`${label} HTTP ${res.status}:`, body)
      console.groupEnd()
      if (res.status === 403 && /requires a subscription|upgrade for access/i.test(body)) {
        throw new Error(`Model ${model} richiede subscription/upgrade sul provider cloud`)
      }
      throw new Error(`HTTP ${res.status}${body ? ': ' + body.slice(0, 200) : ''}`)
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    const parser = provider.createStreamParser()
    let full = ''
    let tokenCount = 0
    let toolCalls = []

    const handleEvent = event => {
      switch (event.type) {
        case 'malformed':
          console.warn(`${label} riga non parsabile:`, event.line)
          break
        // A provider-reported error aborts the turn: it is surfaced to the
        // caller instead of being logged and swallowed, which used to leave
        // the user with an unexplained empty response.
        case 'error':
          throw new Error(event.message)
        case 'toolCalls':
          toolCalls = event.toolCalls
          break
        case 'delta': {
          full += event.text
          tokenCount++
          const visible = separateToolRounds
            ? cleanToolContinuationText(full, previousToolSegment)
            : cleanVisibleText(full)
          const renderedVisible = stripInlineToolSyntax(visible, tools)
          onToken(separateToolRounds ? renderedVisible : [visiblePrefix, renderedVisible].filter(Boolean).join('\n\n'))
          break
        }
        case 'done':
          if (event.content && !full) {
            full = event.content
            const visible = separateToolRounds
              ? cleanToolContinuationText(full, previousToolSegment)
              : cleanVisibleText(full)
            const renderedVisible = stripInlineToolSyntax(visible, tools)
            onToken(separateToolRounds ? renderedVisible : [visiblePrefix, renderedVisible].filter(Boolean).join('\n\n'))
          }
          console.log(`${label} done — tokens: ${tokenCount}, full length: ${full.length}`)
          break
        default:
          break
      }
    }

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          for (const event of parser.flush()) handleEvent(event)
          break
        }
        for (const event of parser.push(decoder.decode(value, { stream: true }))) handleEvent(event)
      }
    } catch (streamErr) {
      clearTimeout(timer)
      onResponse?.({ request: debugRequest, response: { error: streamErr.message } })
      console.error(`${label} stream error:`, streamErr)
      console.groupEnd()
      throw streamErr
    }

    clearTimeout(timer)

    full = separateToolRounds
      ? cleanToolContinuationText(full, previousToolSegment)
      : cleanVisibleText(full)

    if (toolCalls.length === 0) {
      const mdToolRe = /<function>([\w]+)<\/function>\s*```(?:json)?\s*([\s\S]*?)```/g
      let match
      while ((match = mdToolRe.exec(full)) !== null) {
        try {
          const fnName = match[1]
          const args = JSON.parse(match[2].trim())
          toolCalls.push({ function: { name: fnName, arguments: args } })
        } catch {
          // Ignore malformed inline tool call payloads.
        }
      }
      if (toolCalls.length > 0) {
        full = full.replace(/<function>[\w]+<\/function>\s*```(?:json)?[\s\S]*?```/g, '').trim()
      }
    }

    if (toolCalls.length === 0) {
      const knownToolNames = new Set((tools || []).map(tool => tool?.function?.name).filter(Boolean))
      const inlineToolRe = /\b([A-Za-z_]\w*)\s*\(([^()\n]*)\)/g
      let inlineMatch
      while ((inlineMatch = inlineToolRe.exec(full)) !== null) {
        const fnName = inlineMatch[1]
        if (!knownToolNames.has(fnName)) continue
        toolCalls.push({ function: { name: fnName, arguments: parseInlineToolArguments(inlineMatch[2]) } })
      }
      if (toolCalls.length > 0) {
        full = full.replace(/\b([A-Za-z_]\w*)\s*\([^()\n]*\)/g, (match, fnName) => knownToolNames.has(fnName) ? '' : match).replace(/\s{2,}/g, ' ').trim()
      }
    }

    const debugResponse = {
      message: {
        role: 'assistant',
        content: full,
        contentLength: full.length,
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
      },
    }
    onResponse?.({ request: debugRequest, response: debugResponse })
    console.log('← response', { model, ...debugResponse })

    if (toolCalls.length > 0 && toolRound < MAX_TOOL_ROUNDS) {
      toolRound++
      if (full) visiblePrefix = [visiblePrefix, full].filter(Boolean).join('\n\n')
      apiMessages = [...apiMessages, { role: 'assistant', content: full || '', tool_calls: toolCalls }]
      for (const toolCall of toolCalls) {
        const toolName = toolCall.function?.name
        let toolArgs = toolCall.function?.arguments ?? {}
        if (typeof toolArgs === 'string') {
          try { toolArgs = JSON.parse(toolArgs) } catch { toolArgs = { value: toolArgs } }
        }
        onToolInvocation?.({ name: toolName, arguments: toolArgs })
        if (toolName === 'web_search') {
          const query = toolArgs?.query ?? toolArgs
          const queryStr = typeof query === 'string' ? query : JSON.stringify(query)
          const cachedResult = Web.getCachedSearchResult(queryStr)
          if (cachedResult) {
            console.log(`[webSearch] cache hit (tool loop): "${queryStr}"`)
            apiMessages = [...apiMessages, { role: 'tool', content: cachedResult, name: 'web_search' }]
          } else {
            const sourceResult = await Web.searchTopicSources(queryStr, { sourceUrls })
            if (sourceResult) {
              console.log(`[webSearch] source hit: "${queryStr}"`)
              apiMessages = [...apiMessages, { role: 'tool', content: sourceResult, name: 'web_search' }]
              continue
            }
            onToken(separateToolRounds
              ? [full, `*🔍 Web search: "${queryStr}"...*`].filter(Boolean).join('\n\n')
              : [visiblePrefix, full, `*🔍 Web search: "${queryStr}"...*`].filter(Boolean).join('\n\n'))
            const result = await Web.search(queryStr, { noResultsMessage: noResultsMessage(queryStr) })
            apiMessages = [...apiMessages, { role: 'tool', content: result, name: 'web_search' }]
          }
        } else if (typeof executeTool === 'function') {
          const result = await executeTool(toolName, toolArgs)
          if (result != null) {
            apiMessages = [...apiMessages, { role: 'tool', content: String(result), name: toolName }]
          }
        }
      }
      previousToolSegment = full
      onToolRound?.({ content: full, toolCalls, round: toolRound })
      full = ''
      if (!separateToolRounds) onToken(visiblePrefix)
      continue
    }

    if (!full.trim() && !retried && !previousToolSegment) {
      retried = true
      console.warn(`${label} risposta vuota — retry${toolRound > 0 ? ' senza tools' : ''}`)
      full = ''
      onToken(visiblePrefix)
      continue
    }

    console.groupEnd()
    return separateToolRounds ? full.trim() : [visiblePrefix, full].filter(Boolean).join('\n\n')
  }
}
