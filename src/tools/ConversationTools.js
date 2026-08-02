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
}

export const REQUEST_MODERATOR_INTERVENTION_TOOL = {
  type: 'function',
  function: {
    name: 'request_moderator_intervention',
    description: 'Ask the debate moderator for a direct procedural intervention. This schedules one extra moderator turn outside the standard round.',
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why moderator intervention is needed now.' },
        focus: { type: 'string', description: 'What the moderator should clarify, redirect, or enforce.' },
        participantTags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional participant tags the intervention should address.',
        },
      },
      required: [],
    },
  },
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
      role: message.role,
      turn: message.turn ?? null,
      content: String(message.content).trim(),
    }))

  return JSON.stringify({ messages: eligible })
}

export function createConversationToolExecutor({ getMessages, requestModeratorIntervention }) {
  return async (name, args = {}) => {
    if (name === GET_RECENT_MESSAGES_TOOL.function.name) {
      return formatRecentMessages(getMessages?.() || [], args)
    }
    if (name === REQUEST_MODERATOR_INTERVENTION_TOOL.function.name) {
      const result = await requestModeratorIntervention?.(args)
      return JSON.stringify(result || { accepted: false, reason: 'Moderator intervention is not available.' })
    }
    return null
  }
}
