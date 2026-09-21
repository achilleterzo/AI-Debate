import { renderMarkdown } from './Markdown'

/**
 * Message text goes through here on its way to HTML, in the chat and in the
 * export alike: same markdown options, same shorthand clean-up, same result.
 *
 * The rules that make markup safe live in ./Markdown.js, which is the only
 * configured parser in the app.
 */

export function normalizeMathShorthands(text) {
  let out = String(text || '')
  out = out.replace(/\$\s*\\rightarrow\s*\$/g, '→')
  out = out.replace(/\$\s*\\leftarrow\s*\$/g, '←')
  out = out.replace(/\$\s*\\Rightarrow\s*\$/g, '⇒')
  out = out.replace(/\$\s*\\Leftarrow\s*\$/g, '⇐')
  out = out.replace(/\$\s*\\leftrightarrow\s*\$/g, '↔')
  return out
}

/**
 * The chat re-renders on every streamed chunk, and each render asks for the
 * markdown of every message in the transcript, not just the one still being
 * written. Parsing all of them again each time makes the cost of a token grow
 * with the length of the debate, which is what saturates the renderer on long
 * runs. Message text never changes once written, so the HTML for it can be
 * remembered: only the streaming message is a genuine miss.
 *
 * Kept to a bounded number of entries, least recently used evicted first — a
 * streaming message mints a new entry per chunk, and without a cap those would
 * accumulate for the whole run.
 */
const MARKDOWN_CACHE_LIMIT = 400
const markdownCache = new Map()

export function renderMessageMarkdown(text) {
  const key = String(text ?? '')
  const cached = markdownCache.get(key)
  if (cached !== undefined) {
    // Re-insert so the messages the timeline keeps asking for stay hot while
    // the discarded partials of a stream fall off the end.
    markdownCache.delete(key)
    markdownCache.set(key, cached)
    return cached
  }
  const html = renderMarkdown(normalizeMathShorthands(text || ''))
  markdownCache.set(key, html)
  if (markdownCache.size > MARKDOWN_CACHE_LIMIT) markdownCache.delete(markdownCache.keys().next().value)
  return html
}
