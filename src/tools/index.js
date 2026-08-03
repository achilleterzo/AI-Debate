import { WEB_SEARCH_TOOL } from './WebSearchTool'
import { GET_RECENT_MESSAGES_TOOL, REQUEST_MODERATOR_INTERVENTION_TOOL } from './ConversationTools'
import { ROLL_DICE_TOOL } from './DiceTool'
import { MEMORY_TOOL } from './MemoryTool'

/** Tool definitions sent to the LLM when the current request allows tools. */
export const LLM_TOOLS = [WEB_SEARCH_TOOL, GET_RECENT_MESSAGES_TOOL, REQUEST_MODERATOR_INTERVENTION_TOOL, MEMORY_TOOL]
export const ROLE_PLAY_TOOLS = [...LLM_TOOLS, ROLL_DICE_TOOL]

export const TOOL_ICONS = {
  web_search: '🔍',
  get_recent_messages: '🕘',
  request_moderator_intervention: '🙋',
  roll_dice: '🎲',
  memory: '🧠',
}

export {
  GET_RECENT_MESSAGES_TOOL,
  REQUEST_MODERATOR_INTERVENTION_TOOL,
  createConversationToolExecutor,
  formatRecentMessages,
} from './ConversationTools'

export { WEB_SEARCH_TOOL }
export { ROLL_DICE_TOOL, formatDiceRoll, rollDice } from './DiceTool'
export { MEMORY_TOOL, MEMORY_MAX_CONTENT_CHARS, MEMORY_MAX_ENTRIES, readMemory } from './MemoryTool'
