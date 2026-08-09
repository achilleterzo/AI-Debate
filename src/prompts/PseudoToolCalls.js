/**
 * Tool calls a model typed instead of emitting.
 *
 * The markup comes from the training data of the model, not from this app, and
 * it appears in whatever combination the model remembers — a closer with no
 * opener, an opener still streaming, a block nested in another, or the compact
 * `<call:name{...}/>` form some models prefer. None of it ran: a tool is only
 * invoked through the structured interface, so every one of these is a call the
 * user is shown and nobody made.
 *
 * Stripping them matters twice over. In the chat they are noise. In the payload
 * they are worse: a transcript that keeps them teaches the syntax to everyone
 * who reads it, and a table where one model types `<call:roll_dice{...}/>` soon
 * becomes a table where they all do.
 */
const PSEUDO_TOOL_TAGS = 'function_calls|tool_calls|tool_call|invoke|antml:invoke'
const PSEUDO_TOOL_BLOCK_RE = new RegExp(`<(${PSEUDO_TOOL_TAGS})(?:\\s[^>]*)?>[\\s\\S]*?<\\/\\1>`, 'gi')
const PSEUDO_TOOL_OPEN_TAIL_RE = new RegExp(`<(?:${PSEUDO_TOOL_TAGS})(?:\\s[^>]*)?>[\\s\\S]*$`, 'i')
const PSEUDO_TOOL_LOOSE_RE = new RegExp(`<\\/?(?:${PSEUDO_TOOL_TAGS})(?:\\s[^>]*)?>|<\\/?(?:antml:)?parameter(?:\\s[^>]*)?>`, 'gi')

// `<call:quote_message{messageId:540}/>`, `<call:roll_dice{count:1,sides:20}/>`
// and the unclosed variants of both. The braces can carry anything, including
// the `<|"|>` quoting some models use inside them, so the body is matched
// loosely and only up to the first closing marker.
const INLINE_CALL_RE = /<\s*\/?\s*call\s*:\s*[\w.]+\s*(?:\{[\s\S]*?\})?\s*\/?>/gi
const INLINE_CALL_OPEN_TAIL_RE = /<\s*call\s*:\s*[\w.]+\s*\{[^}]*$/i

// A few models use the XML dialect from their training data instead of the
// structured provider event: <call:name key="value"/>.  We accept it only
// for tools that are present in this request; everything else remains text
// to be removed, never an executable instruction.
const XML_CALL_RE = /<\s*call\s*:\s*([\w.]+)(?=[\s/>])([^>]*?)\/?>/gi
const XML_TOOL_BLOCK_RE = /<\s*(?:web_search|fetch_url|get_recent_messages|quote_message|request_moderator_intervention|apply_moderation|roll_dice|memory)\s*>[\s\S]*?<\s*\/\s*(?:web_search|fetch_url|get_recent_messages|quote_message|request_moderator_intervention|apply_moderation|roll_dice|memory)\s*>/gi

function parseXmlCallValue(value) {
  const unquoted = String(value).trim().replace(/^(["'])([\s\S]*)\1$/, '$2')
  const decoded = unquoted
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
  if (decoded === 'true' || decoded === 'false') return decoded === 'true'
  if (/^-?\d+(?:\.\d+)?$/.test(decoded)) return Number(decoded)
  try { return JSON.parse(decoded) } catch { return decoded }
}

function parseXmlCallArguments(raw) {
  const args = {}
  const attributeRe = /([A-Za-z_][\w.-]*)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/g
  let match
  while ((match = attributeRe.exec(raw))) args[match[1]] = parseXmlCallValue(match[2])
  return args
}

function parseXmlToolBlockArguments(raw) {
  const source = String(raw ?? '').trim()
  try {
    const parsed = JSON.parse(source)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : { value: parsed }
  } catch {
    return null
  }
}

export function extractPseudoToolCalls(text, tools = []) {
  const names = new Set((tools || []).map(tool => tool?.function?.name).filter(Boolean))
  const calls = []
  const source = String(text ?? '')
  for (const match of source.matchAll(XML_CALL_RE)) {
    const name = match[1]
    if (!names.has(name)) continue
    calls.push({
      id: `pseudo-${calls.length + 1}`,
      type: 'function',
      function: { name, arguments: parseXmlCallArguments(match[2]) },
    })
  }
  if (names.size > 0) {
    const escapedNames = [...names].map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
    const blockRe = new RegExp(`<\\s*(${escapedNames})\\s*>([\\s\\S]*?)<\\s*\\/\\1\\s*>`, 'gi')
    for (const match of source.matchAll(blockRe)) {
      const args = parseXmlToolBlockArguments(match[2])
      if (!args) continue
      calls.push({
        id: `pseudo-${calls.length + 1}`,
        type: 'function',
        function: { name: match[1], arguments: args },
      })
    }
  }
  return calls
}

export function stripPseudoToolCalls(text) {
  let visible = String(text ?? '')
  let previous
  // Nesting means one pass can expose another complete block.
  do {
    previous = visible
    visible = visible.replace(PSEUDO_TOOL_BLOCK_RE, '')
  } while (visible !== previous)
  return visible
    .replace(PSEUDO_TOOL_OPEN_TAIL_RE, '')
    .replace(PSEUDO_TOOL_LOOSE_RE, '')
    .replace(XML_TOOL_BLOCK_RE, '')
    .replace(XML_CALL_RE, '')
    .replace(INLINE_CALL_RE, '')
    .replace(INLINE_CALL_OPEN_TAIL_RE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
