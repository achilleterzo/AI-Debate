import { SEARCH_ENGINE_IDS } from '../settings/Settings'

/**
 * OpenAI-compatible function definition exposed to language models.
 * Execution stays in services/Web.js so tool contracts and implementations
 * can evolve independently.
 */
export const WEB_SEARCH_TOOL = {
  type: 'function',
  function: {
    name: 'web_search',
    description: 'Search the web for up-to-date information to better answer the question or Fact Check.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query in English or Italian' },
        engine: {
          type: 'string',
          enum: SEARCH_ENGINE_IDS,
          description: "Search engine override. Omit it to use the user's default; 'auto' tries enabled browser engines in order.",
        },
      },
      required: ['query'],
    },
  },
  constraints: [
    'MANDATORY: When current external information is required, invoke web_search through the structured tool interface before making the claim. Never simulate a search or invent its result.',
  ],
}
