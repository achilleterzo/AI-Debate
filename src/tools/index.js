import { WEB_SEARCH_TOOL } from './WebSearchTool'
import { APPLY_MODERATION_TOOL, GET_RECENT_MESSAGES_TOOL, REQUEST_MODERATOR_INTERVENTION_TOOL } from './ConversationTools'
import { ROLL_DICE_TOOL } from './DiceTool'
import { MEMORY_TOOL } from './MemoryTool'

/** Tool definitions sent to the LLM when the current request allows tools. */
export const LLM_TOOLS = [WEB_SEARCH_TOOL, GET_RECENT_MESSAGES_TOOL, REQUEST_MODERATOR_INTERVENTION_TOOL, MEMORY_TOOL]
export const ROLE_PLAY_TOOLS = [...LLM_TOOLS, ROLL_DICE_TOOL]
export const MODERATOR_TOOLS = [APPLY_MODERATION_TOOL]
export const LLM_TOOLS_WITHOUT_MODERATOR_INTERVENTION = LLM_TOOLS.filter(tool => tool.function.name !== REQUEST_MODERATOR_INTERVENTION_TOOL.function.name)
export const ROLE_PLAY_TOOLS_WITHOUT_MODERATOR_INTERVENTION = ROLE_PLAY_TOOLS.filter(tool => tool.function.name !== REQUEST_MODERATOR_INTERVENTION_TOOL.function.name)

export const TOOL_ICONS = {
  web_search: '🔍',
  get_recent_messages: '🕘',
  request_moderator_intervention: '🙋',
  apply_moderation: '🛑',
  roll_dice: '🎲',
  memory: '🧠',
}

export {
  GET_RECENT_MESSAGES_TOOL,
  REQUEST_MODERATOR_INTERVENTION_TOOL,
  APPLY_MODERATION_TOOL,
  createConversationToolExecutor,
  formatRecentMessages,
} from './ConversationTools'

export { WEB_SEARCH_TOOL }
export { ROLL_DICE_TOOL, formatDiceRoll, rollDice } from './DiceTool'
export { MEMORY_TOOL, MEMORY_MAX_CONTENT_CHARS, MEMORY_MAX_ENTRIES, readMemory } from './MemoryTool'
export { TOOL_SETTINGS, DEFAULT_ENABLED_TOOLS, normalizeEnabledTools } from './ToolSettings'
