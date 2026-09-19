/**
 * Tool calls a model typed instead of emitting.
 *
 * The markup comes from the training data of the model, not from this app, and
 * it appears in whatever combination the model remembers — a closer with no
 * opener, an opener still streaming, a block nested in another, the compact
 * `<call:name{...}/>` form some models prefer, or no markup at all: just the
 * arguments of the call, alone on a line. None of it ran: a tool is only
 * invoked through the structured interface, so every one of these is a call the
 * user is shown and nobody made.
 *
 * Stripping them matters twice over. In the chat they are noise. In the payload
 * they are worse: a transcript that keeps them teaches the syntax to everyone
 * who reads it, and a table where one model types `<call:roll_dice{...}/>` soon
 * becomes a table where they all do.
 */

/**
 * The app's own tools, by argument shape.
 *
 * A model narrating a sequence often types only the arguments — `{ "count": 1,
 * "sides": 20 }` under the sentence describing the action — with no name and no
 * markup left to recognise the fragment by. The shape is then the only thing
 * that identifies it as a call rather than prose.
 *
 * Written out here rather than read from the tool definitions: `src/tools`
 * already imports this module's neighbours, so importing it back would close a
 * cycle and leave this table empty at import time. `tests/PseudoToolCalls.test`
 * asserts it still matches the real schemas.
 */
const TOOL_ARGUMENT_SHAPES = {
  web_search: { properties: ['query', 'engine'], required: ['query'] },
  fetch_url: { properties: ['url', 'page', 'mode'], required: ['url'] },
  // No required argument: called bare it lists the attachments. So an empty
  // object is not a call — `matchesShape` rejects it — but a typed
  // `read_attachment` by name is still recognised through KNOWN_TOOL_NAMES.
  read_attachment: { properties: ['name', 'page'], required: [] },
  get_recent_messages: { properties: ['limit', 'participantTags', 'searchTerm'], required: ['limit'] },
  quote_message: { properties: ['messageId', 'excerpt'], required: ['messageId'] },
  request_moderator_intervention: { properties: ['reason'], required: ['reason'] },
  apply_moderation: { properties: ['reason'], required: ['reason'] },
  memory: { properties: ['action', 'content', 'participantTags', 'query', 'limit'], required: ['action'] },
  roll_dice: { properties: ['count', 'sides'], required: ['count', 'sides'] },
}

const KNOWN_TOOL_NAMES = Object.keys(TOOL_ARGUMENT_SHAPES)

const PSEUDO_TOOL_TAGS = 'function_calls|tool_calls|tool_call|invoke|antml:invoke'
// What a model writes when it invents the *result* too, to keep its narration
// moving. Same treatment: nothing ran, so nothing of it is prose.
const PSEUDO_RESULT_TAGS = 'function_results|tool_response|tool_result|tool_output|tool_outputs'
const PSEUDO_BLOCK_TAGS = `${PSEUDO_TOOL_TAGS}|${PSEUDO_RESULT_TAGS}`
const PSEUDO_TOOL_BLOCK_RE = new RegExp(`<(${PSEUDO_BLOCK_TAGS})(?:\\s[^>]*)?>[\\s\\S]*?<\\/\\1>`, 'gi')
const PSEUDO_TOOL_OPEN_TAIL_RE = new RegExp(`<(?:${PSEUDO_BLOCK_TAGS})(?:\\s[^>]*)?>[\\s\\S]*$`, 'i')
const PSEUDO_TOOL_LOOSE_RE = new RegExp(`<\\/?(?:${PSEUDO_BLOCK_TAGS})(?:\\s[^>]*)?>|<\\/?(?:antml:)?parameter(?:\\s[^>]*)?>`, 'gi')

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
const XML_TOOL_BLOCK_RE = new RegExp(`<\\s*(?:${KNOWN_TOOL_NAMES.join('|')})\\s*>[\\s\\S]*?<\\s*\\/\\s*(?:${KNOWN_TOOL_NAMES.join('|')})\\s*>`, 'gi')

// `<roll_dice count="1" sides="20"/>`, `<quote_message messageId="50" />`: the
// tool name used directly as a tag, with its arguments as attributes. This is
// the dialect the models reach for first, and the one that spreads fastest —
// left in the transcript it reads to every other participant as the markup
// they are supposed to imitate, which is how a whole table ends up typing it.
const XML_NAMED_TAG_RE = new RegExp(`<\\s*\\/?\\s*(${KNOWN_TOOL_NAMES.join('|')})\\b([^>]*?)\\/?>`, 'gi')

// The markers other chat templates put around a call. The JSON that follows
// them is removed by the pass below; these leave nothing of the marker itself.
const TOOL_CALL_MARKERS_RE = /\[\/?TOOL_CALLS\]|\[\/?TOOL_RESULTS\]|<\|python_tag\|>|<\|eom_id\|>|<\|eot_id\|>|\bfunctools(?=\s*\[)/gi

/**
 * The call typed without any markup at all: the tool name followed by its
 * arguments, in braces or parentheses.
 *
 * `roll_dice{count:1,sides:20}`, `memory {action: 'write', content: '…'}`,
 * `roll_dice(count=2, sides=10)`. The keys are unquoted, so this is not JSON
 * and the scan above never sees it; there is no tag, so none of the markup
 * patterns do either. It is still a call nobody made, and reading as almost
 * prose is exactly what makes the next participant copy it.
 */
const BRACED_CALL_RE = new RegExp(`\`?\\b(${KNOWN_TOOL_NAMES.join('|')})\\b\`?\\s*\\{([^{}]*)\\}\`?`, 'gi')
const PAREN_CALL_RE = new RegExp(`\`?\\*{0,2}\\b(${KNOWN_TOOL_NAMES.join('|')})\\b\\*{0,2}\`?\\s*\\(([^()\\n]{0,300})\\)\`?`, 'gi')

// Left behind once the JSON inside them is gone.
const EMPTY_FENCE_RE = /```[\w:]*\s*```/g

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

/** Splits on the commas that separate arguments, not on the ones inside a value. */
function splitArguments(raw) {
  const parts = []
  let current = ''
  let quote = null
  for (const char of String(raw ?? '')) {
    if (quote) {
      if (char === quote) quote = null
      current += char
    } else if (char === '"' || char === "'") {
      quote = char
      current += char
    } else if (char === ',') {
      parts.push(current)
      current = ''
    } else {
      current += char
    }
  }
  return [...parts, current].filter(part => part.trim())
}

/**
 * `count: 1, sides: 20`, `action = 'write'`, `"count": 1`.
 *
 * Returns nothing for a body with no pairs in it at all — `1d20` is a notation,
 * not an argument object, and inventing keys for it would run the tool with
 * arguments the model never gave.
 */
function parseTypedArguments(raw) {
  const args = {}
  for (const part of splitArguments(raw)) {
    const separator = part.search(/[:=]/)
    if (separator < 1) continue
    const key = part.slice(0, separator).trim().replace(/^(["'])([\s\S]*)\1$/, '$2')
    const value = part.slice(separator + 1).trim()
    if (!key || !value) continue
    args[key] = parseXmlCallValue(value)
  }
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

/**
 * Where the JSON value opened at `start` ends, or -1 if it never closes.
 *
 * A regex cannot answer this: the arguments of a call are objects themselves
 * and the strings inside them may contain braces, so depth and string state are
 * tracked instead.
 */
function jsonValueEnd(source, start) {
  const opener = source[start]
  const closer = opener === '{' ? '}' : ']'
  let depth = 0
  let inString = false
  let escaped = false
  for (let cursor = start; cursor < source.length; cursor++) {
    const char = source[cursor]
    if (inString) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') inString = true
    else if (char === opener) depth++
    else if (char === closer && --depth === 0) return cursor + 1
  }
  return -1
}

/** Every complete JSON object or array in the text, outermost first, never overlapping. */
function jsonCandidates(source) {
  const found = []
  for (let index = 0; index < source.length; index++) {
    if (source[index] !== '{' && source[index] !== '[') continue
    const end = jsonValueEnd(source, index)
    if (end < 0) continue
    let value
    try {
      value = JSON.parse(source.slice(index, end))
    } catch {
      continue
    }
    found.push({ start: index, end, value })
    index = end - 1
  }
  return found
}

/**
 * A fragment nothing but a call would occupy a line by itself.
 *
 * Arguments recognised by shape alone carry no name, so position is the rest of
 * the evidence: JSON quoted inside a sentence is being talked about, JSON
 * standing on its own between two paragraphs is a call that was typed.
 */
function standsAlone(source, start, end) {
  const before = source.slice(0, start).split('\n').pop()
  const after = source.slice(end).split('\n')[0]
  return /^[\s`>*-]*$/.test(before) && /^[\s`]*$/.test(after)
}

function shapesOf(tools) {
  const entries = (tools || [])
    .map(tool => tool?.function)
    .filter(fn => fn?.name && fn.parameters?.properties)
    .map(fn => [fn.name, {
      properties: Object.keys(fn.parameters.properties),
      required: Array.isArray(fn.parameters.required) ? fn.parameters.required : [],
    }])
  return Object.fromEntries(entries)
}

function matchesShape(args, shape) {
  const keys = Object.keys(args)
  if (keys.length === 0) return false
  return keys.every(key => shape.properties.includes(key))
    && shape.required.every(key => keys.includes(key))
}

/** The tools whose arguments look exactly like this object. */
function toolsMatchingArguments(args, shapes) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) return []
  return Object.entries(shapes).filter(([, shape]) => matchesShape(args, shape)).map(([name]) => name)
}

/** The call a JSON value spells out by name, for one of the given tools. */
function namedCallsIn(value, names) {
  if (Array.isArray(value)) return value.flatMap(entry => namedCallsIn(entry, names))
  if (!value || typeof value !== 'object') return []
  const inner = value.function && typeof value.function === 'object' ? value.function : value
  const name = typeof inner.name === 'string' ? inner.name : ''
  if (!names.has(name)) return []
  const raw = inner.arguments ?? inner.parameters ?? inner.args ?? {}
  let args = raw
  if (typeof raw === 'string') {
    try { args = JSON.parse(raw) } catch { args = {} }
  }
  return [{ name, arguments: args && typeof args === 'object' && !Array.isArray(args) ? args : {} }]
}

export function extractPseudoToolCalls(text, tools = []) {
  const names = new Set((tools || []).map(tool => tool?.function?.name).filter(Boolean))
  const shapes = shapesOf(tools)
  const calls = []
  const source = String(text ?? '')
  const push = (name, args) => calls.push({
    id: `pseudo-${calls.length + 1}`,
    type: 'function',
    function: { name, arguments: args },
  })

  for (const match of source.matchAll(XML_CALL_RE)) {
    if (!names.has(match[1])) continue
    push(match[1], parseXmlCallArguments(match[2]))
  }
  for (const match of source.matchAll(XML_NAMED_TAG_RE)) {
    // The opener of a paired block carries no arguments; that form is read as a
    // block below, and counting it here would invoke the tool twice.
    if (!names.has(match[1]) || !match[2].trim()) continue
    push(match[1], parseXmlCallArguments(match[2]))
  }
  if (names.size > 0) {
    const escapedNames = [...names].map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
    const blockRe = new RegExp(`<\\s*(${escapedNames})\\s*>([\\s\\S]*?)<\\s*\\/\\1\\s*>`, 'gi')
    for (const match of source.matchAll(blockRe)) {
      const args = parseXmlToolBlockArguments(match[2])
      if (args) push(match[1], args)
    }
  }

  // Written as prose, so the arguments are only trusted when they fit the
  // schema of the tool named: everything present, nothing invented. Anything
  // looser is removed from the text without being run.
  for (const pattern of [BRACED_CALL_RE, PAREN_CALL_RE]) {
    for (const match of source.matchAll(pattern)) {
      const shape = shapes[match[1]]
      if (!shape) continue
      const args = parseTypedArguments(match[2])
      if (matchesShape(args, shape)) push(match[1], args)
    }
  }

  for (const candidate of jsonCandidates(source)) {
    const named = namedCallsIn(candidate.value, names)
    if (named.length > 0) {
      for (const call of named) push(call.name, call.arguments)
      continue
    }
    // Arguments with no name are only run when one tool of this request could
    // have taken them: two candidates mean the call cannot be reconstructed,
    // and guessing would run something the model never asked for.
    if (!standsAlone(source, candidate.start, candidate.end)) continue
    const matching = toolsMatchingArguments(candidate.value, shapes)
    if (matching.length === 1) push(matching[0], candidate.value)
  }

  return calls
}

/**
 * The text with every typed call removed.
 *
 * Unlike extraction this is not limited to the tools of the current request:
 * markup and arguments for a tool nobody offered are still a call nobody made,
 * and leaving them in the message is what teaches the syntax to the table.
 */
function stripJsonToolCalls(source) {
  if (!source.includes('{') && !source.includes('[')) return source
  const allNames = new Set(KNOWN_TOOL_NAMES)
  const removals = jsonCandidates(source).filter(candidate => {
    if (namedCallsIn(candidate.value, allNames).length > 0) return true
    return standsAlone(source, candidate.start, candidate.end)
      && toolsMatchingArguments(candidate.value, TOOL_ARGUMENT_SHAPES).length > 0
  })
  if (removals.length === 0) return source
  let result = ''
  let cursor = 0
  for (const removal of removals) {
    result += source.slice(cursor, removal.start)
    cursor = removal.end
  }
  return result + source.slice(cursor)
}

/**
 * An argument object the model started and never finished.
 *
 * While the answer streams this is every call for a moment, and when the reply
 * is cut short it is what the message ends on for good. There is no closing
 * brace to match, so the keys typed so far have to carry the recognition: all
 * of them belonging to one tool is not something prose does.
 */
function stripUnclosedArguments(source) {
  const start = source.lastIndexOf('{')
  if (start < 0 || jsonValueEnd(source, start) >= 0) return source
  const before = source.slice(0, start).split('\n').pop()
  if (!/^[\s`>*-]*$/.test(before)) return source
  const tail = source.slice(start)
  const keys = [...tail.matchAll(/"([A-Za-z_][\w]*)"\s*:/g)].map(match => match[1])
  if (keys.length === 0) return source
  const belongsToOneTool = Object.values(TOOL_ARGUMENT_SHAPES)
    .some(shape => keys.every(key => shape.properties.includes(key)))
  return belongsToOneTool ? source.slice(0, start) : source
}

export function stripPseudoToolCalls(text) {
  let visible = String(text ?? '')
  let previous
  // Nesting means one pass can expose another complete block.
  do {
    previous = visible
    visible = visible.replace(PSEUDO_TOOL_BLOCK_RE, '')
  } while (visible !== previous)
  visible = visible
    .replace(PSEUDO_TOOL_OPEN_TAIL_RE, '')
    .replace(PSEUDO_TOOL_LOOSE_RE, '')
    .replace(XML_TOOL_BLOCK_RE, '')
    .replace(XML_NAMED_TAG_RE, '')
    .replace(XML_CALL_RE, '')
    .replace(INLINE_CALL_RE, '')
    .replace(INLINE_CALL_OPEN_TAIL_RE, '')
    .replace(TOOL_CALL_MARKERS_RE, '')
    .replace(BRACED_CALL_RE, '')
    .replace(PAREN_CALL_RE, '')
  visible = stripUnclosedArguments(stripJsonToolCalls(visible))
  return visible
    .replace(EMPTY_FENCE_RE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
