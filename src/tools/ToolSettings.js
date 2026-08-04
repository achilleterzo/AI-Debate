export const TOOL_SETTINGS = [
  { id: 'web_search', icon: '🔍', labelKey: 'webSearch' },
  { id: 'get_recent_messages', icon: '🕘', labelKey: 'getRecentMessages' },
  { id: 'request_moderator_intervention', icon: '🙋', labelKey: 'requestModeratorIntervention' },
  { id: 'apply_moderation', icon: '🛑', labelKey: 'applyModeration', moderatorOnly: true },
  { id: 'memory', icon: '🧠', labelKey: 'memory' },
  { id: 'roll_dice', icon: '🎲', labelKey: 'rollDice', rolePlayOnly: true },
]

export const DEFAULT_ENABLED_TOOLS = Object.fromEntries(TOOL_SETTINGS.map(tool => [tool.id, true]))

export function normalizeEnabledTools(raw) {
  return Object.fromEntries(TOOL_SETTINGS.map(tool => [tool.id, raw?.[tool.id] !== false]))
}
