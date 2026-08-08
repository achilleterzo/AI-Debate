import { Web } from '../services/Web'

/**
 * OpenAI-compatible function definition exposed to language models.
 * Execution stays in services/Web.js so tool contracts and implementations
 * can evolve independently.
 *
 * The page comes back as Markdown with its links intact, which is what makes
 * the tool iterative: an agent reads a homepage, sees `[Contacts](…)` in it,
 * and calls the tool again on that link. A summary would have removed exactly
 * the part that lets it do so.
 */
export const FETCH_URL_TOOL = {
  type: 'function',
  function: {
    name: 'fetch_url',
    description: 'Read a web page and return its full content as Markdown, with links preserved so you can follow them with further fetch_url calls. Long pages are returned one block at a time: the reply states how many blocks there are and you can request the next one.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Absolute http(s) URL of the page to read' },
        page: { type: 'integer', description: 'Which block of a long page to return, starting at 1. Defaults to 1.' },
        mode: {
          type: 'string',
          enum: ['markdown', 'raw'],
          description: "'markdown' (default) returns clean Markdown with links; 'raw' returns the unprocessed text of the page, for verbatim quotation.",
        },
      },
      required: ['url'],
    },
  },
  constraints: [
	""
  ],
}

/**
 * Runs the tool call. Returns text in every case, failures included: a page
 * that could not be read has to say so, or the model fills the silence.
 */
export async function executeFetchUrl(args) {
  const url = typeof args === 'string' ? args : String(args?.url ?? '')
  const mode = args?.mode === 'raw' ? 'raw' : 'markdown'
  const result = await Web.readUrl(url, { page: args?.page ?? 1, mode })
  return result.text
}
