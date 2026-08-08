export const GET_RECENT_MESSAGES_TOOL = {
  type: 'function',
  function: {
    name: 'get_recent_messages',
    description: 'Return the most recent debate messages, optionally restricted to one or more participant tags. Use this when the available context does not include the exchanges you need.',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 1, maximum: 50, description: 'Maximum number of messages to return.' },
        participantTags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional participant tags to include, for example ["A"] or ["A", "C"]. Omit to include all speakers.',
        },
        searchTerm: { type: 'string', description: 'Optional case-insensitive term or phrase that must appear in the message content.' },
      },
      required: ['limit'],
    },
  },
  constraints: [
    ""
  ],
}

export const REQUEST_MODERATOR_INTERVENTION_TOOL = {
  type: 'function',
  function: {
    name: 'request_moderator_intervention',
    description: 'Ask the debate moderator for an explicit extra turn outside the standard round. Available only when a moderator is present.',
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why the moderator should intervene now.' },
      },
      required: ['reason'],
    },
  },
  constraints: [
    ""
  ],
}

export const APPLY_MODERATION_TOOL = {
  type: 'function',
  function: {
    name: 'apply_moderation',
    description: 'Apply a procedural moderation intervention. Available only to the debate moderator; the reason is shown as a separate moderation message.',
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'The concise reason and directive for the moderation intervention.' },
      },
      required: ['reason'],
    },
  },
  constraints: [
    ""
  ],
}

export function formatRecentMessages(messages = [], { limit = 10, participantTags = [], searchTerm = '' } = {}) {
  const requestedLimit = Math.min(50, Math.max(1, Number(limit) || 10))
  const tags = new Set((Array.isArray(participantTags) ? participantTags : [participantTags])
    .map(tag => String(tag || '').trim().toLowerCase())
    .filter(Boolean))
  const normalizedSearchTerm = String(searchTerm || '').trim().toLowerCase()
  const eligible = messages
    .filter(message => message?.content?.trim() && !['participant_joined', 'participant_left', 'error'].includes(message.role))
    .filter(message => tags.size === 0 || tags.has(String(message.role || '').toLowerCase()))
    .filter(message => !normalizedSearchTerm || String(message.content).toLowerCase().includes(normalizedSearchTerm))
    .slice(-requestedLimit)
    .map(message => ({
      // The id travels with the message so a result pulled from outside the
      // visible window can still be cited with quote_message.
      ...(message.seq != null ? { id: message.seq } : {}),
      role: message.role,
      turn: message.turn ?? null,
      content: String(message.content).trim(),
    }))

  return JSON.stringify({ messages: eligible })
}

export function createConversationToolExecutor({ getMessages, requestModeratorIntervention, applyModeration, rollDice, memory, quote }) {
  return async (name, args = {}) => {
    if (name === GET_RECENT_MESSAGES_TOOL.function.name) {
      return formatRecentMessages(getMessages?.() || [], args)
    }
    if (name === 'quote_message') {
      const result = await quote?.(args)
      return result == null
        ? JSON.stringify({ accepted: false, reason: 'Quoting is not available.' })
        : JSON.stringify(result)
    }
    if (name === REQUEST_MODERATOR_INTERVENTION_TOOL.function.name) {
      const result = await requestModeratorIntervention?.(args)
      return JSON.stringify(result || { accepted: false, reason: 'Moderator intervention is not available.' })
    }
    if (name === 'roll_dice') {
      const result = await rollDice?.(args)
      return result == null
        ? JSON.stringify({ accepted: false, reason: 'Dice are available only in Role Play mode.' })
        : JSON.stringify(result)
    }
    if (name === APPLY_MODERATION_TOOL.function.name) {
      const result = await applyModeration?.(args)
      return JSON.stringify(result || { accepted: false, reason: 'Moderation is not available.' })
    }
    if (name === 'memory') {
      const result = await memory?.(args)
      return result == null
        ? JSON.stringify({ accepted: false, reason: 'Memory is not available.' })
        : JSON.stringify(result)
    }
    return null
  }
}
