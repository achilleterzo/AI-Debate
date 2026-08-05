import { marked } from 'marked'

/**
 * Message text goes through here on its way to HTML, in the chat and in the
 * export alike: same markdown options, same shorthand clean-up, same result.
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

export function renderMessageMarkdown(text) {
  return marked.parse(normalizeMathShorthands(text || ''))
}
