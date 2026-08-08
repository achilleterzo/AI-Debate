/**
 * Direct citation of another message in the debate.
 *
 * Every message carried in a participant's payload is announced with its own
 * `[#id]` marker (see `Debate.pushHistoryMsg`), and that id is the `seq` the
 * timeline already assigns and persists. The tool turns one of those ids into a
 * quotation attached to the turn being written: the chat renders it as a short
 * clickable card that jumps to the original, and every later payload carries it
 * so the other participants know exactly which message was answered.
 */

/** Roles that exist in the transcript but are not something one can quote. */
const NON_QUOTABLE_ROLES = ['error', 'participant_joined', 'participant_left', 'pending']

export const QUOTE_MAX_EXCERPT_CHARS = 240

export const QUOTE_MESSAGE_TOOL = {
  type: 'function',
  function: {
    name: 'quote_message',
    description: 'Cite one specific earlier message by its id. Every message in this conversation is announced with an id marker like [#12]; pass that number to attach a visible quotation to the turn you are writing. Use it when you answer, contest, or build on something a specific participant said, so that everyone can see exactly which message you mean. The tool returns the full text of the quoted message.',
    parameters: {
      type: 'object',
      properties: {
        messageId: {
          type: 'integer',
          description: 'Id of the message being quoted, without the hash: for [#12] pass 12.',
        },
        excerpt: {
          type: 'string',
          description: 'Optional verbatim fragment of that message to show in the quotation. It must appear literally in the quoted message. Omit it to quote the opening of the message.',
        },
      },
      required: ['messageId'],
    },
  },
  constraints: [
    ""
  ],
}

function normalizeForMatch(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().toLowerCase()
}

/** Collapses a message down to the short form the quotation card shows. */
export function abbreviateQuote(text, maxChars = QUOTE_MAX_EXCERPT_CHARS) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxChars) return normalized
  // Cut on a word boundary when one is close enough, so the card does not end
  // in the middle of a word for the sake of a handful of characters.
  const hardCut = normalized.slice(0, maxChars)
  const lastSpace = hardCut.lastIndexOf(' ')
  return `${(lastSpace > maxChars * 0.6 ? hardCut.slice(0, lastSpace) : hardCut).trimEnd()}…`
}

/** The message carrying `messageId`, or null when nothing quotable matches. */
export function resolveQuotableMessage(messages = [], messageId) {
  const id = Number(messageId)
  if (!Number.isFinite(id)) return null
  return messages.find(message => (
    message?.seq === id
    && !NON_QUOTABLE_ROLES.includes(message.role)
    && String(message.content ?? '').trim()
  )) || null
}

/** Ids the model may still cite, offered back when it asks for a missing one. */
export function quotableMessageIds(messages = [], limit = 12) {
  return messages
    .filter(message => (
      message?.seq != null
      && !NON_QUOTABLE_ROLES.includes(message.role)
      && String(message.content ?? '').trim()
    ))
    .slice(-limit)
    .map(message => message.seq)
}

/**
 * Resolves one citation request into the record attached to the turn.
 *
 * A quotation nobody can check is worse than none, so an excerpt the model
 * invents is not shown as if it had been read: the card falls back to the real
 * opening of the message and the tool result says so, which is enough for the
 * model to correct itself in the same turn.
 */
export function buildQuote({ messages = [], participants = [], messageId, excerpt = '' }) {
  const target = resolveQuotableMessage(messages, messageId)
  if (!target) {
    return {
      accepted: false,
      reason: `No quotable message with id ${messageId} exists in this conversation.`,
      availableIds: quotableMessageIds(messages),
    }
  }

  const author = target.participantSnapshot
    || participants.find(participant => participant.tag === target.role)
    || null
  const fullText = String(target.content).trim()
  const requested = String(excerpt || '').trim()
  const verbatim = !!requested && normalizeForMatch(fullText).includes(normalizeForMatch(requested))

  return {
    accepted: true,
    quote: {
      messageId: target.seq,
      role: target.role,
      turn: target.turn ?? null,
      authorTag: author?.tag ?? target.role,
      authorName: author?.name || author?.tag || null,
      excerpt: abbreviateQuote(verbatim ? requested : fullText),
      verbatim,
    },
    text: fullText,
    ...(requested && !verbatim
      ? { warning: 'The excerpt you passed does not appear in that message, so the opening of the real message was quoted instead. Do not attribute the wording you invented to that participant.' }
      : {}),
  }
}
