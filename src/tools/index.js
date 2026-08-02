import { WEB_SEARCH_TOOL } from './WebSearchTool'
import { GET_RECENT_MESSAGES_TOOL, REQUEST_MODERATOR_INTERVENTION_TOOL } from './ConversationTools'

/** Tool definitions sent to the LLM when the current request allows tools. */
export const LLM_TOOLS = [WEB_SEARCH_TOOL, GET_RECENT_MESSAGES_TOOL, REQUEST_MODERATOR_INTERVENTION_TOOL]

export const TOOL_ICONS = {
  web_search: '🔍',
  get_recent_messages: '🕘',
  request_moderator_intervention: '🙋',
}

export {
  GET_RECENT_MESSAGES_TOOL,
  REQUEST_MODERATOR_INTERVENTION_TOOL,
  createConversationToolExecutor,
  formatRecentMessages,
} from './ConversationTools'

export { WEB_SEARCH_TOOL }
