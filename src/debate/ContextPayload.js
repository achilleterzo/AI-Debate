/**
 * How one message of the transcript is written into a participant's payload.
 *
 * Two rules shape everything below.
 *
 * Ids: every message the actor did not write is announced by `[#seq]`, the same
 * number the timeline assigns and the snapshots keep, so `quote_message` has a
 * stable handle and a cited id always resolves to a message the reader can open.
 * The actor's own turns stay bare on purpose — a model that reads a marker on
 * its own words starts writing markers of its own.
 *
 * Citations: a quotation is not left implicit in the id. The excerpt travels
 * with the message, because an id alone tells the other participants that
 * something was cited without telling them what, and they would have to spend a
 * `get_recent_messages` call to find out.
 */

/** Marker announcing a message, empty for anything the timeline never numbered. */
export function idMarker(message) {
  return message?.seq != null ? `[#${message.seq}] ` : ''
}

/** What a turn cites, rendered for the participants reading that turn later. */
export function formatQuoteAnnotation(quotes = [], actorTag = '') {
  const rendered = (quotes || [])
    .filter(quote => quote?.messageId != null)
    .map(quote => {
      const who = quote.authorTag && quote.authorTag === actorTag
        ? 'you'
        : (quote.authorName || quote.authorTag || 'unknown')
      return `[#${quote.messageId}] ${who}: "${quote.excerpt}"`
    })
  return rendered.length > 0 ? ` (citing ${rendered.join(' ; ')})` : ''
}

/**
 * One transcript message as the `{ role, content }` pair sent to the model, or
 * `null` when it carries nothing worth sending.
 */
export function formatHistoryMessage({ message, actor, participants = [] }) {
  const asUser = content => ({ role: 'user', content })

  if (message.role === 'topic') return asUser(`${idMarker(message)}[Topic]: ${message.content}`)
  if (message.role === 'participant_joined' || message.role === 'participant_left') return null
  if (message.role === 'user') return asUser(`${idMarker(message)}[Moderator]: ${message.content}`)
  if (message.role === 'interjection') return asUser(`${idMarker(message)}[Topic update]: ${message.content}`)

  if (message.role === 'dice') {
    const ownerName = message.diceOwner?.name || message.diceOwner?.tag || 'a participant'
    return asUser(`${idMarker(message)}[DICE RESULT — NUMBERS SHARED WITH ALL PARTICIPANTS]\nThe individual tool call was made by ${ownerName}. Preserve that ownership: use the result as established, do not claim the group rolled it, do not retract it, and do not roll it again.\n${message.content}`)
  }

  if (message.content && message.content.trim().startsWith('<function_calls>')) return null
  // A turn that produced nothing is not a contribution. Passing it on as
  // `Name said:` with no words makes the others read the table as silent and
  // spend their own turns asking who has not spoken yet.
  if (!String(message.content ?? '').trim()) return null

  if (message.role === actor.tag) return { role: 'assistant', content: message.content }

  const other = participants.find(participant => participant.tag === message.role)
  const otherName = other?.name || other?.tag || message.role
  const citation = formatQuoteAnnotation(message.quotes, actor.tag)
  return asUser(other?.isModerator
    ? `${idMarker(message)}[MODERATOR DIRECTIVE — PROCEDURAL AUTHORITY]\n${otherName}${citation}: ${message.content}\n\nThis is a binding process instruction. Follow it in your next response; do not debate or ignore it.`
    : `${idMarker(message)}${otherName} said${citation}: ${message.content}`)
}
