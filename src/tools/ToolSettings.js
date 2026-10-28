export const TOOL_SETTINGS = [
  { id: 'web_search', icon: '🔍', labelKey: 'webSearch' },
  { id: 'fetch_url', icon: '🌐', labelKey: 'fetchUrl' },
  { id: 'read_attachment', icon: '📎', labelKey: 'readAttachment' },
  { id: 'view_image', icon: '🖼️', labelKey: 'viewImage' },
  { id: 'get_recent_messages', icon: '🕘', labelKey: 'getRecentMessages' },
  { id: 'quote_message', icon: '❝', labelKey: 'quoteMessage' },
  { id: 'request_moderator_intervention', icon: '🙋', labelKey: 'requestModeratorIntervention' },
  { id: 'apply_moderation', icon: '🛑', labelKey: 'applyModeration', moderatorOnly: true },
  { id: 'memory', icon: '🧠', labelKey: 'memory' },
  // Off unless a mode asks for it: Role Play does, any other mode may.
  { id: 'roll_dice', icon: '🎲', labelKey: 'rollDice', rolePlayOnly: true, defaultEnabled: false },
]

export const DEFAULT_ENABLED_TOOLS = Object.fromEntries(TOOL_SETTINGS.map(tool => [tool.id, tool.defaultEnabled !== false]))

export function normalizeEnabledTools(raw) {
  return Object.fromEntries(TOOL_SETTINGS.map(tool => [tool.id, typeof raw?.[tool.id] === 'boolean' ? raw[tool.id] : tool.defaultEnabled !== false]))
}
