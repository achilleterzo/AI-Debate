export const MEMORY_TOOL = {
  type: 'function',
  function: {
    name: 'memory',
    description: 'Store or retrieve durable shared memory. A write belongs to the participant who invokes it, while the stored entry can be read by everyone. For reading, omit participantTags to return all memory; provide one or more participant tags to return only entries authored by those participants.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['write', 'read'], description: 'Write a durable memory entry or read existing entries.' },
        content: { type: 'string', description: 'Context worth preserving for future turns. Required for write.' },
        participantTags: { type: 'array', items: { type: 'string' }, description: 'Optional author tags for read. Omit or use an empty list to read all memory.' },
        query: { type: 'string', description: 'Optional case-insensitive text filter for read.' },
        limit: { type: 'integer', minimum: 1, maximum: 100, description: 'Maximum entries to return for read.' },
      },
      required: ['action'],
    },
  },
  constraints: [
	""
  ],
}

export const MEMORY_MAX_ENTRIES = 200
export const MEMORY_MAX_CONTENT_CHARS = 4000

export function readMemory(entries = [], { participantTags = [], query = '', limit = 50 } = {}) {
  const tags = new Set((Array.isArray(participantTags) ? participantTags : [participantTags])
    .map(tag => String(tag || '').trim().toLowerCase())
    .filter(Boolean))
  const search = String(query || '').trim().toLowerCase()
  const max = Math.min(100, Math.max(1, Number(limit) || 50))
  const selected = entries
    .filter(entry => !tags.size || tags.has(String(entry.authorTag || '').toLowerCase()))
    .filter(entry => !search || String(entry.content || '').toLowerCase().includes(search))
    .slice(-max)
  return { count: selected.length, entries: selected }
}
