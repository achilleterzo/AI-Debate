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
      },
      required: ['query'],
    },
  },
}
