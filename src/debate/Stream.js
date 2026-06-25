import { Web } from '../services/Web'

function trimText(txt, maxChars) {
  const s = String(txt || '')
  if (s.length <= maxChars) return s
  return s.slice(0, Math.max(0, maxChars - 28)) + '\n\n...[truncated for context]'
}

function compactMessages(arr, { keepLast = 2, maxPerMsg = 12000 } = {}) {
  const out = []
  const sys = arr.find(message => message.role === 'system')
  if (sys) out.push({ ...sys, content: trimText(sys.content, maxPerMsg) })
  const nonSystem = arr.filter(message => message.role !== 'system')
  const tail = nonSystem.slice(-keepLast).map(message => ({ ...message, content: trimText(message.content, maxPerMsg) }))
  return [...out, ...tail]
}

export async function streamChat({
  baseUrl,
  model,
  messages,
  onToken,
  timeoutMs = 120_000,
  systemPrompt = null,
  useTools = false,
  onPayload = null,
  onEstimate = null,
  noResultsMessage = query => `No results for: ${query}`,
  sourceUrls = [],
}) {
  const label = `[ollama] ${model}`
  console.group(label)

  let apiMessages = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, ...messages.map(message => ({ role: message.ollamaRole, content: message.content }))]
    : messages.map(message => ({ role: message.ollamaRole, content: message.content }))

  apiMessages = apiMessages.reduce((acc, message) => {
    const prev = acc[acc.length - 1]
    if (prev && prev.role === message.role) {
      acc[acc.length - 1] = { ...prev, content: prev.content + '\n\n' + message.content }
    } else {
      acc.push(message)
    }
    return acc
  }, [])

  const MAX_TOOL_ROUNDS = 2
  let toolRound = 0
  let retried = false
  let retriedTooLong = false
  let retriedServerError = false
  const supportsTools = !['deepseek', 'minimax'].some(token => model.toLowerCase().includes(token))

  while (true) {
    const payloadMessages = compactMessages(apiMessages, { keepLast: 3, maxPerMsg: 18000 })
    const totalChars = payloadMessages.reduce((count, message) => count + String(message.content || '').length, 0)
    const estimatedTokens = Math.ceil(totalChars / 4)
    if (typeof onEstimate === 'function') {
      onEstimate({ model, messageCount: payloadMessages.length, totalChars, estimatedTokens })
    }
    if (payloadMessages.length !== apiMessages.length || payloadMessages.some((message, index) => message.content !== (apiMessages[index]?.content ?? ''))) {
      console.warn(`${label} payload compattato prima dell'invio (context guard)`)
    }
    console.log('→ payload', { model, messages: payloadMessages })
    if (onPayload) onPayload({ model, messages: payloadMessages })

    const controller = new AbortController()
    const timer = setTimeout(() => {
      console.warn(`${label} timeout dopo ${timeoutMs / 1000}s — abort`)
      controller.abort()
    }, timeoutMs)

    let res
    try {
      res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: payloadMessages,
          stream: true,
          ...(useTools && supportsTools && toolRound < MAX_TOOL_ROUNDS && !retried ? { tools: [Web.WEB_SEARCH_TOOL] } : {}),
        }),
      })
    } catch (err) {
      clearTimeout(timer)
      console.error(`${label} fetch error:`, err)
      console.groupEnd()
      throw err.name === 'AbortError'
        ? new Error(`Timeout: nessuna risposta da ${model} dopo ${timeoutMs / 1000}s`)
        : err
    }

    if (!res.ok) {
      clearTimeout(timer)
      const body = await res.text().catch(() => '')
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
    let full = ''
    let tokenCount = 0
    let toolCalls = []

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        for (const line of chunk.split('\n')) {
          if (!line.trim()) continue
          try {
            const json = JSON.parse(line)
            if (json.error) {
              console.error(`${label} error da Ollama:`, json.error)
              throw new Error(json.error)
            }
            if (json.message?.tool_calls?.length) {
              toolCalls = json.message.tool_calls
            }
            if (json.message?.content) {
              full += json.message.content
              tokenCount++
              let visible = full.replace(/<think>[\s\S]*?<\/think>/g, '').trimStart()
              visible = visible.replace(/<\|tool[▁_]calls[▁_]begin\|>[\s\S]*?<\|tool[▁_]calls[▁_]end\|>/g, '').trimEnd()
              visible = visible.replace(/<\|tool[▁_]calls[▁_]begin\|>[\s\S]*/g, '').trimEnd()
              onToken(visible || full)
            }
            if (json.done) {
              if (json.message?.content && !full) {
                full = json.message.content
                onToken(full.replace(/<think>[\s\S]*?<\/think>/g, '').trimStart() || full)
              }
              console.log(`${label} done — tokens: ${tokenCount}, full length: ${full.length}`)
            }
          } catch (parseErr) {
            if (line.trim() && !(parseErr instanceof SyntaxError)) {
              console.warn(`${label} riga non parsabile:`, line, parseErr)
            }
          }
        }
      }
    } catch (streamErr) {
      clearTimeout(timer)
      console.error(`${label} stream error:`, streamErr)
      console.groupEnd()
      throw streamErr
    }

    clearTimeout(timer)

    full = full.replace(/<think>[\s\S]*?<\/think>/g, '').trimStart()
    full = full.replace(/<\|tool[▁_]calls[▁_]begin\|>[\s\S]*?<\|tool[▁_]calls[▁_]end\|>/g, '').trimEnd()
    full = full.replace(/<\|tool[▁_]calls[▁_]begin\|>[\s\S]*/g, '').trimEnd()

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

    console.log('← response', {
      model,
      message: {
        role: 'assistant',
        content: full,
        contentLength: full.length,
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
      },
    })

    if (toolCalls.length > 0 && toolRound < MAX_TOOL_ROUNDS) {
      toolRound++
      apiMessages = [...apiMessages, { role: 'assistant', content: full || '', tool_calls: toolCalls }]
      for (const toolCall of toolCalls) {
        if (toolCall.function?.name === 'web_search') {
          const query = toolCall.function.arguments?.query ?? toolCall.function.arguments
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
            onToken((full || '') + `\n\n*🔍 Web search: "${queryStr}"...*`)
            const result = await Web.search(queryStr, { noResultsMessage: noResultsMessage(queryStr) })
            apiMessages = [...apiMessages, { role: 'tool', content: result, name: 'web_search' }]
          }
        }
      }
      full = ''
      onToken('')
      continue
    }

    if (!full.trim() && toolRound > 0 && !retried) {
      retried = true
      console.warn(`${label} risposta vuota dopo tool rounds — retry senza tools`)
      full = ''
      onToken('')
      continue
    }

    console.groupEnd()
    return full
  }
}
