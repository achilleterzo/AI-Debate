/**
 * Reasoning a model wrote into the message instead of into the thinking
 * channel.
 *
 * `<think>` is what a thinking-capable model emits when the channel is not
 * used; the others turn up on models with no thinking capability at all, which
 * answer a "deliberate in X, answer in Y" instruction by inventing a block for
 * the deliberation and leaving it in the prose — in the reasoning language,
 * above the actual contribution.
 *
 * None of it is the contribution. It is stripped as the turn streams, and again
 * wherever a stored message becomes model input: a transcript written before
 * the cleaning existed still carries such a block, and every later turn would
 * otherwise ship one participant's private monologue to all the others as if it
 * were something they had said out loud.
 */
import { stripPseudoToolCalls } from './PseudoToolCalls'

const REASONING_TAGS = 'think|thinking|thought|thoughts|reasoning|reflection|deliberation|scratchpad|inner_monologue'
// A model improvising this markup does not always close what it opened with the
// same name — `<reasoning>` answered by `</think>` is common enough that
// requiring a matching pair here made the block invisible to the strip and the
// whole answer fall under the unclosed-opener rule below. Any of these closers
// ends any of these openers.
const REASONING_BLOCK_RE = new RegExp(`<(${REASONING_TAGS})(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:${REASONING_TAGS})\\s*>`, 'gi')
const REASONING_OPEN_TAIL_RE = new RegExp(`<(${REASONING_TAGS})(?:\\s[^>]*)?>([\\s\\S]*)$`, 'i')
const REASONING_LOOSE_RE = new RegExp(`<\\/?(?:${REASONING_TAGS})(?:\\s[^>]*)?>`, 'gi')

/**
 * The text without the monologue.
 *
 * An opener with no closer normally takes everything after it: while the block
 * is still streaming the balloon would otherwise show the monologue itself.
 *
 * `keepUnclosedTail` is the exception, for a response that is already complete.
 * There, an opener the model never closed is the difference between a turn and
 * nothing at all — everything it wrote sits inside that block — so the caller
 * can ask for the text with the markup removed instead of losing the turn.
 */
export function stripLeakedReasoning(text, { keepUnclosedTail = false } = {}) {
  let visible = String(text ?? '')
  let previous
  // Nesting means one pass can expose another complete block.
  do {
    previous = visible
    visible = visible.replace(REASONING_BLOCK_RE, '')
  } while (visible !== previous)
  if (!keepUnclosedTail) visible = visible.replace(REASONING_OPEN_TAIL_RE, '')
  return visible.replace(REASONING_LOOSE_RE, '')
}

/**
 * What a stored message says, for anyone reading it after the fact.
 *
 * Two kinds of transport are removed, because neither is something the author
 * said to the table: the deliberation they wrote instead of thinking silently,
 * and the tool calls they typed instead of emitting. The second matters most
 * here — a transcript that keeps a typed call hands every other participant a
 * worked example of the syntax, and the table converges on writing calls nobody
 * executes.
 *
 * The text is complete here — nothing is still arriving — so the unclosed-opener
 * rule has no streaming to protect and only one consequence left: a turn that
 * disappears from the context, from the citations and from the summary while
 * the reader still sees it in the chat. Strict first, and the markup-only strip
 * when strict would leave nothing at all.
 */
export function visibleContribution(text) {
  const strict = stripLeakedReasoning(text).trim()
  return stripPseudoToolCalls(strict || stripLeakedReasoning(text, { keepUnclosedTail: true }))
}

/**
 * The monologue taken out of the visible message, so the turn keeps it.
 *
 * What the model wrote there is the same material the thinking channel would
 * have carried: dropping it silently would lose the only record of how the turn
 * was decided, so it joins the native thinking instead.
 */
export function extractLeakedReasoning(text) {
  const source = String(text ?? '')
  const parts = [...source.matchAll(REASONING_BLOCK_RE)].map(match => match[2])
  const openTail = source.replace(REASONING_BLOCK_RE, '').match(REASONING_OPEN_TAIL_RE)
  if (openTail) parts.push(openTail[2])
  return parts.map(part => part.trim()).filter(Boolean).join('\n\n')
}
