import { Web } from '../services/Web'
import { getProvider } from '../providers/index.js'
import { stripPromptScaffolding } from '../prompts/PromptTags'
import { extractLeakedReasoning, stripLeakedReasoning } from '../prompts/ReasoningLeak'
import { extractPseudoToolCalls, stripPseudoToolCalls } from '../prompts/PseudoToolCalls'
import { LLM_TOOLS, executeFetchUrl } from '../tools'

/**
 * Sent when the turn has no tool rounds left, or when the model answered with
 * silence. Withdrawing the tools from the request is not a message the model
 * can read: this is.
 */
/**
 * Sent when the whole answer was deliberation.
 *
 * The plain nudge asks for an answer, which the model believes it already gave:
 * it wrote one, inside a reasoning block, and the block does not reach the
 * table. Naming what happened is what makes the second attempt different.
 */
const REASONING_ONLY_NUDGE = 'Your previous message contained only internal deliberation — a <think>/<reasoning> block — so the other participants received nothing at all. That deliberation is not delivered to anyone, whatever it contains. Deliberate silently instead and write the contribution itself now: plain prose, in your response language, with no reasoning section and no <think>, <reasoning> or similar tags anywhere in it.'

/**
 * Sent when the model answered with a tool call nobody will run.
 *
 * Withdrawing the tools from the request does not stop every model from
 * emitting one, and a call that is not executed produces no tool result: the
 * model is left waiting for an answer that will never arrive and announces the
 * same call again. It is told plainly that the call was dropped — the turn is
 * unblocked by the fact, not by asking for the answer a second time.
 */
const IGNORED_TOOL_CALL_NUDGE = 'The tool call in your last message was NOT executed and no tool result will follow it: tool use for this turn is finished. Anything you wrote alongside it — announcing a call, planning one, correcting yourself about the protocol — is not a contribution and the other participants never see it. Write your actual contribution now, in prose, using the tool results already above. Do not emit another tool call and do not describe one.'

/**
 * Above this, visible text next to a dropped tool call is the turn itself.
 *
 * The models that keep calling after the rounds are spent write two very
 * different things beside that call: a line of self-talk about the protocol, or
 * the entire contribution. The first is a few dozen characters, the second
 * thousands, and nothing else in the response tells them apart.
 */
const PREAMBLE_MAX_CHARS = 400

const FINAL_ANSWER_NUDGE = 'Tool use for this turn is over — no further tool call will be executed, and asking for one will produce nothing. Using the tool results already in this conversation, write your full contribution now, following your system instructions. If a tool returned nothing useful, say what you could not verify instead of assuming it is absent. Do not announce further searches, and do not reply with an empty message.'

/**
 * Identity of a tool call, for spotting one the turn has already answered.
 *
 * Keys are sorted so that `{url, page}` and `{page, url}` are the same call:
 * the arguments come back as JSON from the model, in whatever order it wrote
 * them, and a repeat is a repeat regardless of how it was typed.
 */
function toolResultKey(name, args) {
  const canonical = args && typeof args === 'object' && !Array.isArray(args)
    ? Object.fromEntries(Object.entries(args).sort(([left], [right]) => left.localeCompare(right)))
    : args
  return `${name}|${JSON.stringify(canonical ?? null)}`
}

/**
 * Stands in for a result the conversation is already carrying.
 *
 * A model that asks for the same page twice in one turn used to get a second
 * verbatim copy appended: a 26 KB page became 53 KB of payload, and every
 * later request in the turn carried both. The content it needs is already
 * above, so the repeat is answered with a pointer to it.
 */
function repeatedToolResultNote(name) {
  return `The ${name} call with these exact arguments already ran in this turn and its full result is earlier in this conversation. Nothing has changed, so it is not repeated here: read the result above and continue from it.`
}

/**
 * Thrown when the user cut the stream instead of waiting for it.
 *
 * Distinct from a timeout, which aborts the same request through the same
 * signal: a timeout is a failure worth showing in the chat, while this one is
 * the user having already decided the turn is over.
 */
export class StreamAbortedError extends Error {
  constructor() {
    super('Stream stopped on request')
    this.name = 'StreamAbortedError'
  }
}

/**
 * The requests in flight, so a forced stop can end them now.
 *
 * The ordinary stop is cooperative: it is read between turns, so the model that
 * is already speaking streams to the end — which on a long answer is exactly
 * the wait the user was trying to cut. Nothing short of aborting the request
 * ends that, so every controller joins this set for as long as it is open.
 */
const openRequests = new Set()

export function abortActiveStreams() {
  for (const controller of openRequests) controller.abort()
  openRequests.clear()
}

/**
 * The opening of the pinned conversation summary.
 *
 * Exported because the debate writes it and this file has to recognise it:
 * they were two copies of the same literal, and the wrapper tag the debate
 * later puts around every context message silently broke the match here — the
 * summary stopped being recognised as one, so it was neither pinned nor
 * counted. `isSummaryMessage` therefore looks past a leading wrapper tag
 * instead of anchoring on the raw start of the content.
 */
export const CONVERSATION_SUMMARY_MARKER = '[Conversation summary so far]'

export function isSummaryMessage(message) {
  return String(message?.content || '')
    .replace(/^\s*<[a-z_]+>\s*/i, '')
    .startsWith(CONVERSATION_SUMMARY_MARKER)
}

/**
 * What one message may occupy when no context budget was configured. Only the
 * calls that carry no conversation — a character profile, a round summary —
 * land here; a turn is invoked with the user's setting.
 */
const DEFAULT_MESSAGE_BUDGET_CHARS = 32_000

/**
 * The floor under a derived budget. A summary is compacted at roughly the same
 * size as the context setting, so subtracting it can leave nothing at all —
 * and a per-message allowance below an ordinary turn would mangle every
 * message to save room the transcript no longer has anyway.
 */
const MIN_MESSAGE_BUDGET_CHARS = 4_000

/**
 * The system prompt is instructions, not conversation, and it does not come
 * out of the conversation budget: at a 2 KB setting, trimming it to that would
 * cut the persona, the shared rules and the tool protocol out of the turn.
 */
const MAX_SYSTEM_PROMPT_CHARS = 32_000

/** Emergency shrink after the provider rejected the payload as too long. */
const TOO_LONG_RETRY_BUDGET_CHARS = 6_000

function trimText(txt, maxChars) {
  const s = String(txt || '')
  if (s.length <= maxChars) return s
  return s.slice(0, Math.max(0, maxChars - 28)) + '\n\n...[truncated for context]'
}

/**
 * How the configured context is shared out, in characters.
 *
 * `perMessage` is what one ordinary message may take: the budget minus what
 * the pinned summary has already spent. Deriving it is what removes the fixed
 * ceiling that used to cut a long message at 32 000 characters however much
 * context the user had configured, and to allow 32 000 to a single message
 * however little.
 *
 * `summary` is separate because the summary is charged once, when it is
 * subtracted above. Trimming it again to what is left would charge it twice —
 * and at a small setting the floor under `perMessage` is larger than the room
 * actually left, so the pinned summary was the message that got cut. Both
 * numbers come from here so they cannot drift apart.
 */
export function resolveBudget(messages = [], contextChars = 0) {
  if (!Number.isFinite(contextChars) || contextChars <= 0) {
    return { perMessage: DEFAULT_MESSAGE_BUDGET_CHARS, summary: DEFAULT_MESSAGE_BUDGET_CHARS }
  }
  const pinned = messages
    .filter(isSummaryMessage)
    .reduce((total, message) => total + String(message?.content || '').length, 0)
  return {
    perMessage: Math.max(MIN_MESSAGE_BUDGET_CHARS, contextChars - pinned),
    summary: contextChars,
  }
}

/**
 * How much of one message may travel, by role.
 *
 * A tool result is not conversation that grew too long: it is exactly the
 * material the model asked for, already cut to the size the user configured
 * for a page block. Trimming it again to the prose budget silently overrode
 * that setting — a 64 KB block arrived as 18 KB with a truncation notice, and
 * the model reasoned over the remainder as if the page ended there. It keeps
 * whichever allowance is larger, so lowering the block size still lowers what
 * is sent, and the guard still bounds a tool that returns far more than asked.
 */
function messageBudget(message, maxPerMsg, maxSummary) {
  // Already charged against the budget by resolveBudget, so it is not trimmed
  // to the remainder it paid for.
  if (isSummaryMessage(message)) return maxSummary
  return message?.role === 'tool'
    ? Math.max(maxPerMsg, Web.maxToolResultChars())
    : maxPerMsg
}

export function compactMessages(arr, {
  keepLast = Infinity,
  maxPerMsg = DEFAULT_MESSAGE_BUDGET_CHARS,
  maxSummary = maxPerMsg,
  maxSystem = MAX_SYSTEM_PROMPT_CHARS,
} = {}) {
  const out = []
  const sys = arr.find(message => message.role === 'system')
  if (sys) out.push({ ...sys, content: trimText(sys.content, maxSystem) })
  const nonSystem = arr.filter(message => message.role !== 'system')
  const recent = Number.isFinite(keepLast) ? nonSystem.slice(-keepLast) : nonSystem
  const summary = nonSystem.find(isSummaryMessage)
  const selected = summary && !recent.includes(summary) ? [summary, ...recent] : recent
  const tail = selected.map(message => ({ ...message, content: trimText(message.content, messageBudget(message, maxPerMsg, maxSummary)) }))
  return [...out, ...tail]
}

function cleanVisibleText(text, options) {
  let visible = stripLeakedReasoning(text, options).trimStart()
  // Some Ollama/Gemma responses leak internal channel markers as visible
  // content after a tool round. They are transport control tokens, not prose.
  visible = visible
    .replace(/<\|?channel\|?>/gi, '')
    .replace(/<\|?(?:analysis|final|message)\|?>/gi, '')
    .replace(/<\|?(?:tool_call|tool_calls)\|?>/gi, '')
    .replace(/<\|?(?:turn|turns)\|?>/gi, '')
  // Models sometimes echo back the delimiters that wrap what they were given,
  // and sometimes narrate inside them. Both are ours, not prose: left in, they
  // leak the prompt scaffolding into the chat and into every export made from
  // it. Removing the block can empty the message, which the empty-answer retry
  // below then treats as the non-answer it is.
  visible = stripPromptScaffolding(visible)
  visible = visible.replace(/```(?:json)?\s*([\s\S]*?)```/gi, (block, jsonText) => {
    try {
      const parsed = JSON.parse(jsonText.trim())
      return parsed && (parsed.action === 'write' || parsed.action === 'read') ? '' : block
    } catch {
      return block
    }
  })
  visible = visible.replace(/<\|tool[▁_]calls[▁_]begin\|>[\s\S]*?<\|tool[▁_]calls[▁_]end\|>/g, '').trimEnd()
  visible = visible.replace(/<\|tool[▁_]calls[▁_]begin\|>[\s\S]*/g, '').trimEnd()
  return stripPseudoToolCalls(visible)
}

function cleanToolContinuationText(text, previousSegment = '', options) {
  let visible = cleanVisibleText(text, options)
  const previous = cleanVisibleText(previousSegment)
  if (previous && visible === previous) return ''
  if (previous && visible.startsWith(previous)) visible = visible.slice(previous.length).trimStart()
  // Some tool-capable models finish a leaked JSON argument on the next round.
  if (visible && [...visible].every(char => '{}[],'.includes(char) || /\s/.test(char))) return ''
  return visible
}

/*
 * A call typed into the visible message is not an invocation, and it does not
 * stay in the turn either: `prompts/PseudoToolCalls` removes every dialect of
 * it — markup, JSON envelope, bare argument object, or the plain
 * `name{...}` / `name(...)` a model writes when it wants the scene to move on.
 * Leaving it in was worse than noise: the next participant read that turn and
 * copied the syntax, until a whole table was typing calls nobody ran.
 *
 * What can be reconstructed is reconstructed. When the arguments fit the schema
 * of the tool named, the call is normalized into a real tool_calls entry below
 * and actually runs, which is what the model was reaching for. When they do not
 * — `roll_dice(1d20)` names no arguments at all — the text is cleaned and
 * nothing is invented on the model's behalf.
 */

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
  onComplete = null,
  onEstimate = null,
  noResultsMessage = query => `No results for: ${query}`,
  executeTool = null,
  onToolInvocation = null,
  onToolRound = null,
  onThinking = null,
  think = true,
  provider = getProvider(),
  // What this request is for, in the console. Turns, round summaries and
  // attachment summaries all logged the same `[provider] model` line, which
  // left no way to tell from the log which one was firing.
  purpose = '',
  // The run's cooperative stop flag, when the caller has one. Aborting ends the
  // request in flight; this is what stops the turn from opening the next one
  // — the round after a tool result, or a retry — while it unwinds.
  stopRef = null,
  // The conversation budget the user configured, in characters. The guard below
  // sizes itself on it instead of on a fixed ceiling; 0 keeps its own default,
  // which is what the calls that carry no conversation want.
  contextChars = 0,
}) {
  const label = `[${provider.id}] ${model}${purpose ? ` — ${purpose}` : ''}`
  console.group(label)

  let apiMessages = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, ...messages.map(message => ({ role: message.role, content: message.content }))]
    : messages.map(message => ({ role: message.role, content: message.content }))

  const MAX_TOOL_ROUNDS = 2
  let toolRound = 0
  // Tool calls this turn has already answered, so a repeat costs a pointer
  // instead of a second copy of the same page in every remaining request.
  const deliveredToolResults = new Set()
  let nudgedForAnswer = false
  let retried = false
  // What the attempt before the retry had to show. A retry that produces
  // nothing must not cost the turn the text it already had.
  let fallbackContent = ''
  let retriedTooLong = false
  let retriedServerError = false
  let visiblePrefix = ''
  let previousToolSegment = ''
  // Not asked for a turn that would not use a tool anyway: the answer is
  // cached per endpoint and model, but the first lookup is a request.
  const supportsTools = useTools && await provider.supportsTools(model, { baseUrl })
  // `think` against a model without the capability is an HTTP 400, not a
  // quietly ignored field: the turn is lost outright. Asked only when the
  // request would actually carry the flag.
  const wantsThinking = think !== false && think != null
  const thinkLevel = wantsThinking && !(await provider.supportsThinking(model, { baseUrl })) ? null : think
  const separateToolRounds = typeof onToolRound === 'function'

  while (true) {
    // Recomputed per round: a tool result joins `apiMessages` between rounds,
    // and the summary it has to share the budget with is already in there.
    const budget = resolveBudget(apiMessages, contextChars)
    const payloadMessages = compactMessages(apiMessages, { maxPerMsg: budget.perMessage, maxSummary: budget.summary })
    const totalChars = payloadMessages.reduce((count, message) => count + String(message.content || '').length, 0)
    const estimatedTokens = Math.ceil(totalChars / 4)
    if (typeof onEstimate === 'function') {
      onEstimate({ model, messageCount: payloadMessages.length, totalChars, estimatedTokens })
    }
    if (payloadMessages.length !== apiMessages.length || payloadMessages.some((message, index) => message.content !== (apiMessages[index]?.content ?? ''))) {
      console.warn(`${label} payload compacted before sending (context guard)`)
    }
    if (stopRef?.current) throw new StreamAbortedError()
    const controller = new AbortController()
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      console.warn(`${label} timed out after ${timeoutMs / 1000}s — aborting`)
      controller.abort()
    }, timeoutMs)
    openRequests.add(controller)
    const releaseRequest = () => {
      clearTimeout(timer)
      openRequests.delete(controller)
    }
    // An abort that no timer asked for is the user having forced the stop.
    const abortReason = () => (timedOut
      ? new Error(`Timeout: no answer from ${model} after ${timeoutMs / 1000}s`)
      : new StreamAbortedError())

    const wantsTools = useTools && supportsTools && toolRound < MAX_TOOL_ROUNDS && !retried
    const request = provider.buildChatRequest({
      baseUrl,
      model,
      messages: payloadMessages,
      // An empty array is still a tools array to the provider, and to some
      // chat templates it reads as "tools exist" — enough to get a pseudo-call.
      tools: wantsTools && tools?.length ? tools : null,
      think: thinkLevel,
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
      releaseRequest()
      onResponse?.({ request: debugRequest, response: { error: err.message } })
      console.error(`${label} fetch error:`, err)
      console.groupEnd()
      throw err.name === 'AbortError' ? abortReason() : err
    }

    if (!res.ok) {
      releaseRequest()
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
        console.warn(`${label} prompt too long — retrying with a reduced context`)
        // Never above the emergency size — the point is to get under a context
        // window we cannot measure — and never above what was configured, so a
        // small setting is not overshot by the retry that is meant to shrink.
        const retryBudget = resolveBudget(apiMessages, contextChars)
        apiMessages = compactMessages(apiMessages, {
          keepLast: 1,
          maxPerMsg: Math.min(TOO_LONG_RETRY_BUDGET_CHARS, retryBudget.perMessage),
          maxSummary: Math.min(TOO_LONG_RETRY_BUDGET_CHARS, retryBudget.summary),
        })
        continue
      }
      console.error(`${label} HTTP ${res.status}:`, body)
      console.groupEnd()
      if (res.status === 403 && /requires a subscription|upgrade for access/i.test(body)) {
        throw new Error(`Model ${model} requires a subscription or upgrade on the cloud provider`)
      }
      throw new Error(`HTTP ${res.status}${body ? ': ' + body.slice(0, 200) : ''}`)
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    const parser = provider.createStreamParser()
  let full = ''
  let thinking = ''
  let leakedReasoning = ''
  let tokenCount = 0
  let toolCalls = []
  let doneReason = null

    // The channel and the leak are the same material and belong in the same
    // place, so a turn that reasoned in prose still shows its reasoning.
    const combinedThinking = () => [thinking, leakedReasoning].filter(Boolean).join('\n\n')
    const reportThinking = () => onThinking?.(combinedThinking())

    const handleEvent = event => {
      switch (event.type) {
        case 'malformed':
          console.warn(`${label} unparsable line:`, event.line)
          break
        // A provider-reported error aborts the turn: it is surfaced to the
        // caller instead of being logged and swallowed, which used to leave
        // the user with an unexplained empty response.
        case 'error':
          throw new Error(event.message)
        case 'thinking':
          thinking += event.text
          // Thinking is deliberately kept out of visible content. Consumers
          // may use it for diagnostics or a private progress indicator.
          reportThinking()
          break
        case 'toolCalls':
          // Ollama may emit tool calls across multiple streaming chunks.
          // Keep every chunk as prescribed by the API instead of replacing
          // the calls received earlier in the same assistant turn.
          toolCalls = [...toolCalls, ...event.toolCalls]
          break
        case 'delta': {
          full += event.text
          tokenCount++
          const leaked = extractLeakedReasoning(full)
          if (leaked !== leakedReasoning) {
            leakedReasoning = leaked
            reportThinking()
          }
          const visible = separateToolRounds
            ? cleanToolContinuationText(full, previousToolSegment)
            : cleanVisibleText(full)
          onToken(separateToolRounds ? visible : [visiblePrefix, visible].filter(Boolean).join('\n\n'))
          break
        }
        case 'done':
          doneReason = event.doneReason ?? doneReason
          if (event.content && !full) {
            full = event.content
            leakedReasoning = extractLeakedReasoning(full)
            if (leakedReasoning) reportThinking()
            const visible = separateToolRounds
              ? cleanToolContinuationText(full, previousToolSegment)
              : cleanVisibleText(full)
            onToken(separateToolRounds ? visible : [visiblePrefix, visible].filter(Boolean).join('\n\n'))
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
      releaseRequest()
      onResponse?.({ request: debugRequest, response: { error: streamErr.message } })
      console.error(`${label} stream error:`, streamErr)
      console.groupEnd()
      throw streamErr.name === 'AbortError' ? abortReason() : streamErr
    }

    releaseRequest()

    const rawStreamContent = full
    const pseudoToolCalls = wantsTools
      ? extractPseudoToolCalls(rawStreamContent, tools)
      : []
    if (pseudoToolCalls.length > 0) {
      console.warn(`${label} calls typed into the text normalized into tool_calls:`, pseudoToolCalls)
      toolCalls = [...toolCalls, ...pseudoToolCalls]
    }
    const rawVisibleContent = cleanVisibleText(rawStreamContent)
    full = separateToolRounds
      ? cleanToolContinuationText(full, previousToolSegment)
      : cleanVisibleText(full)

    const reasoningTrace = combinedThinking()
    const debugResponse = {
      message: {
        role: 'assistant',
        content: full,
        contentLength: full.length,
        ...(reasoningTrace ? { thinking: reasoningTrace, thinkingLength: reasoningTrace.length } : {}),
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
      },
      ...(doneReason ? { done_reason: doneReason } : {}),
    }
    onResponse?.({ request: debugRequest, response: debugResponse })
    onComplete?.({
      rawContent: rawStreamContent,
      visibleContent: rawVisibleContent,
      content: full,
      thinking: reasoningTrace,
      doneReason,
      toolCalls,
    })
    console.log('← response', { model, ...debugResponse })

    // Only a request that actually carried tools can have solicited a call.
    // Some models emit one anyway; running the round for it spent a request on
    // a call nothing could execute and split the turn into two segments for
    // nothing. Unsolicited calls fall through to the dropped-call path below,
    // which at least tells the model what happened.
    if (toolCalls.length > 0 && wantsTools) {
      toolRound++
      if (full) visiblePrefix = [visiblePrefix, full].filter(Boolean).join('\n\n')
      apiMessages = [...apiMessages, {
        role: 'assistant',
        ...(thinking ? { thinking } : {}),
        content: full || '',
        tool_calls: toolCalls,
      }]
      const appendToolResult = (name, args, content) => {
        const key = toolResultKey(name, args)
        const repeated = deliveredToolResults.has(key)
        deliveredToolResults.add(key)
        if (repeated) console.log(`${label} ${name} repeated with the same arguments — result not attached again`)
        apiMessages = [...apiMessages, {
          role: 'tool',
          tool_name: name,
          content: repeated ? repeatedToolResultNote(name) : String(content),
        }]
      }
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
            appendToolResult('web_search', toolArgs, cachedResult)
          } else {
            onToken(separateToolRounds
              ? [full, `*🔍 Web search: "${queryStr}"...*`].filter(Boolean).join('\n\n')
              : [visiblePrefix, full, `*🔍 Web search: "${queryStr}"...*`].filter(Boolean).join('\n\n'))
            const result = await Web.search(queryStr, { noResultsMessage: noResultsMessage(queryStr) })
            appendToolResult('web_search', toolArgs, result)
          }
        } else if (toolName === 'fetch_url') {
          const targetUrl = String(toolArgs?.url ?? '')
          const pageLabel = Number(toolArgs?.page) > 1 ? ` (block ${Number(toolArgs.page)})` : ''
          onToken(separateToolRounds
            ? [full, `*🌐 Reading: ${targetUrl}${pageLabel}...*`].filter(Boolean).join('\n\n')
            : [visiblePrefix, full, `*🌐 Reading: ${targetUrl}${pageLabel}...*`].filter(Boolean).join('\n\n'))
          const result = await executeFetchUrl(toolArgs)
          appendToolResult('fetch_url', toolArgs, result)
        } else if (typeof executeTool === 'function') {
          const result = await executeTool(toolName, toolArgs)
          if (result != null) appendToolResult(toolName, toolArgs, result)
        }
      }
      // Out of tool rounds, so the next reply is the answer. Saying so is what
      // stops a turn from ending as a row of tool pills and nothing else: with
      // the tools merely withdrawn from the request, a model that was still
      // working the problem just returns an empty message and burns its turn.
      if (toolRound >= MAX_TOOL_ROUNDS && !nudgedForAnswer) {
        nudgedForAnswer = true
        apiMessages = [...apiMessages, { role: 'user', content: FINAL_ANSWER_NUDGE }]
      }

      previousToolSegment = full
      onToolRound?.({ content: full, toolCalls, round: toolRound })
      full = ''
      if (!separateToolRounds) onToken(visiblePrefix)
      continue
    }

    // The model wrote something and the cleaning left nothing: worth saying so,
    // because from the outside it is indistinguishable from a silent model.
    const emptiedByCleaning = !full.trim() && rawStreamContent.trim()
    if (emptiedByCleaning) {
      console.warn(`${label} ${rawStreamContent.length}-character answer cleaned down to nothing${leakedReasoning ? ' — all of it sat inside a reasoning block' : ''}`)
    }

    // Reaching here with tool calls means the turn had no round left to run
    // them: nothing was executed and no result will follow. The model is still
    // mid-plan — whatever it wrote next to that call announces an action that
    // never happened — so this is not the contribution either.
    const droppedToolCalls = toolCalls.length > 0
    const emptyAnswer = !full.trim()
    // A few models stop after opening a markup/tool delimiter. It is not an
    // empty string, but it is not a usable contribution either; publishing
    // it creates a balloon that looks blank except for a stray `<` or similar
    // transport character.
    const danglingMarkupAnswer = /^[<>{}[\]`]+$/.test(full.trim())
    // A line announcing a call is not a turn; a finished turn that happens to
    // carry a stray call still is. Length is the only thing that separates them
    // from outside, and getting it wrong in the generous direction costs one
    // request while getting it wrong in the other throws away a whole
    // contribution the user already watched arrive.
    const answeredAnyway = droppedToolCalls && full.trim().length > PREAMBLE_MAX_CHARS

    // A provider may acknowledge the tool result with an empty assistant
    // message. A previous segment must not suppress the retry: after a tool
    // round the continuation is a new response and still needs visible text.
    const worthRetrying = emptyAnswer
      ? (!previousToolSegment || toolRound > 0)
      : danglingMarkupAnswer
        ? true
        : (droppedToolCalls && !answeredAnyway)
    if (droppedToolCalls && answeredAnyway) {
      console.warn(`${label} tool call dropped next to a complete answer — publishing the answer`)
    }
    if (worthRetrying && !retried) {
      retried = true
      console.warn(`${label} ${emptyAnswer ? 'empty answer' : danglingMarkupAnswer ? 'answer cut off on markup' : 'answer with a tool call nobody can run'} — retrying`)
      fallbackContent = full
      // The retry used to repeat the request unchanged whenever a nudge had
      // already been sent when the tool rounds ran out — same input, same
      // non-answer. Every retry now says something the previous request did
      // not, and says the thing that actually applies: a monologue that never
      // reached the table, a tool call nobody ran, or plain silence.
      nudgedForAnswer = true
      apiMessages = [...apiMessages, {
        role: 'user',
        content: leakedReasoning ? REASONING_ONLY_NUDGE : droppedToolCalls ? IGNORED_TOOL_CALL_NUDGE : FINAL_ANSWER_NUDGE,
      }]
      full = ''
      // The balloon keeps whatever the attempt had written. Blanking it made
      // the user watch a finished answer vanish and the turn sit empty for the
      // length of another request, which reads as the app losing the response.
      onToken(separateToolRounds ? fallbackContent : [visiblePrefix, fallbackContent].filter(Boolean).join('\n\n'))
      continue
    }

    // The retry answered with nothing usable. Whatever the attempt before it
    // wrote is still better than an empty balloon.
    if (!full.trim() && fallbackContent.trim()) {
      console.warn(`${label} retry produced nothing — publishing the text from the previous attempt`)
      full = fallbackContent
      onToken(separateToolRounds ? full : [visiblePrefix, full].filter(Boolean).join('\n\n'))
    }

    // The retry has been spent and the turn is still empty because everything
    // the model wrote sits inside a reasoning block it never closed. Publishing
    // it without the markup is worse than a clean answer and better than the
    // blank balloon that is the only other option left.
    if (!full.trim() && leakedReasoning && rawStreamContent.trim()) {
      full = separateToolRounds
        ? cleanToolContinuationText(rawStreamContent, previousToolSegment, { keepUnclosedTail: true })
        : cleanVisibleText(rawStreamContent, { keepUnclosedTail: true })
      if (full.trim()) {
        console.warn(`${label} reasoning block never closed — publishing the turn without the tags rather than losing it`)
        onToken(separateToolRounds ? full : [visiblePrefix, full].filter(Boolean).join('\n\n'))
      }
    }

    console.groupEnd()
    return separateToolRounds ? full.trim() : [visiblePrefix, full].filter(Boolean).join('\n\n')
  }
}
