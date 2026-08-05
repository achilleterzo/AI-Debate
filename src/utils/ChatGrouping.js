/**
 * How a turn is assembled out of the raw message list.
 *
 * The chat and the HTML export used to each decide on their own where a tool
 * pill, a dice result or a follow-up balloon belonged, and the export drifted:
 * tools were always dumped after the text and continuations came out as
 * separate messages. Both now go through the helpers below, so a saved debate
 * shows the same sequence as the live chat.
 */

const NON_PARTICIPANT_ROLES = ['participant_joined', 'participant_left', 'dice', 'topic', 'interjection', 'error']

export function isRenderableParticipantMessage(message) {
  return !!message && !NON_PARTICIPANT_ROLES.includes(message.role)
}

export function resolveActor(message, participants) {
  return message?.participantSnapshot || participants.find(participant => participant.tag === message?.role) || null
}

export function resolveDiceOwner(message, participants) {
  return participants.find(participant => (
    (message?.diceOwner?.id != null && participant.id === message.diceOwner.id)
    || (message?.diceOwner?.tag && participant.tag === message.diceOwner.tag)
  )) || message?.participantSnapshot || message?.diceOwner || null
}

export function describeToolInvocation(invocation) {
  const args = invocation?.arguments || {}
  if (invocation?.name === 'web_search') return args.query || ''
  if (invocation?.name === 'get_recent_messages') {
    return [args.searchTerm, Array.isArray(args.participantTags) && args.participantTags.length ? `@${args.participantTags.join(', @')}` : null]
      .filter(Boolean).join(' · ')
  }
  if (invocation?.name === 'request_moderator_intervention') return args.reason || args.focus || ''
  if (invocation?.name === 'roll_dice' && args.count && args.sides) return `${args.count}d${args.sides}`
  return Object.values(args).filter(value => typeof value === 'string').join(' · ')
}

/**
 * Everything needed to render one participant turn, or `null` when the message
 * has already been folded into the group started by an earlier one.
 *
 * `isLocalUser` tells the two callers apart on the one point where they differ:
 * the chat knows which participant is driven by the human, the export does not.
 */
export function buildMessageGroup({ items, itemIndex, participants, isLocalUser = () => false }) {
  const msg = items[itemIndex]?.msg
  const actor = resolveActor(msg, participants)
  if (!msg || !actor) return null

  const isModeratorMessage = !!actor.isModerator && !isLocalUser(actor)
  const isModerationIntervention = isModeratorMessage && msg.messageType === 'moderation'

  const previousMessage = items[itemIndex - 1]?.msg
  const previousActor = isRenderableParticipantMessage(previousMessage) ? resolveActor(previousMessage, participants) : null
  const previousDiceOwner = previousMessage?.role === 'dice' ? resolveDiceOwner(previousMessage, participants) : null
  // What the moderator writes after apply_moderation is a continuation of the
  // moderation itself: the group anchored on the moderation message already
  // absorbs it, so treating it as a fresh group would render it twice.
  const isContinuation = (
    !isModerationIntervention
    && (
      (previousActor?.id === actor.id && previousMessage.turn === msg.turn)
      || (previousDiceOwner?.id === actor.id)
    )
  )
  if (isContinuation) return null

  const continuationItems = []
  for (let continuationIndex = itemIndex + 1; continuationIndex < items.length; continuationIndex += 1) {
    const candidate = items[continuationIndex]?.msg
    if (!candidate) break
    if (candidate.messageType === 'moderation') break
    if (candidate.role === 'dice') {
      if (resolveDiceOwner(candidate, participants)?.id !== actor.id) break
      continuationItems.push(candidate)
      continue
    }
    const candidateActor = resolveActor(candidate, participants)
    if (candidateActor?.id !== actor.id || candidate.turn !== msg.turn) break
    continuationItems.push(candidate)
  }

  const continuationText = [msg.content, ...continuationItems.filter(candidate => candidate.role !== 'dice').map(candidate => candidate.content)]
    .filter(Boolean)
    .join('\n\n')
  // A moderation intervention is one statement: the reason passed to the tool
  // and the directive written right after it go in the same balloon, instead of
  // leaving the directive hanging outside the moderation frame.
  const primaryContent = isModerationIntervention ? continuationText : msg.content

  const toolEvents = msg.toolEvents?.length
    ? msg.toolEvents
    : (msg.toolInvocations || []).map(invocation => ({ type: 'invocation', invocation, beforeContent: false }))

  return {
    msg,
    actor,
    isModeratorMessage,
    isModerationIntervention,
    continuationItems,
    continuationText,
    primaryContent,
    leadingToolEvents: toolEvents.filter(event => event.type === 'invocation' && event.beforeContent),
    trailingToolEvents: toolEvents.filter(event => !(event.type === 'invocation' && event.beforeContent)),
    leadingDiceResults: continuationItems.filter(candidate => candidate.role === 'dice' && candidate.beforeContent),
    primaryIsLastBalloon: !continuationItems.some(candidate => candidate.role !== 'dice'),
  }
}

/** True when the continuation balloon at `index` is the last one of the group. */
export function isLastContinuationBalloon(continuationItems, index) {
  return !continuationItems.slice(index + 1).some(candidate => candidate.role !== 'dice')
}

/** The tail hangs off the square corner, which faces away from the centre. */
export function tailClassFor(actor) {
  return actor && actor.id % 2 === 0 ? 'balloon-tail-left' : 'balloon-tail-right'
}

/** Left column for even ids, right column for odd ones — as in the chat. */
export function alignmentFor(actor) {
  return actor && actor.id % 2 === 0 ? 'flex-start' : 'flex-end'
}
