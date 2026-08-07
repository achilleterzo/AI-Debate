import { Marked } from 'marked'

/**
 * The one configured Markdown pipeline. Everything that turns text into HTML
 * goes through here — the chat, the exports — so a rule written once holds
 * everywhere, and nobody can reach a laxer parser by importing `marked`
 * directly.
 *
 * The previous setup mutated the `marked` singleton with `setOptions`, which
 * silently applied one module's renderer to another module's parse calls.
 */

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * What a link is allowed to point at.
 *
 * An allowlist rather than a blocklist: `javascript:` and `data:text/html`
 * were both reachable before, and enumerating every dangerous scheme is a
 * game you lose once. Relative targets and anchors stay permitted because the
 * exported HTML uses them.
 */
const SAFE_URL_RE = /^(?:https?:\/\/|mailto:|tel:|#|\/|\.{1,2}\/)/i

function safeUrl(href) {
  const raw = String(href ?? '').trim()
  if (!raw || !SAFE_URL_RE.test(raw)) return null
  return raw
}

const markdown = new Marked()

markdown.use({
  renderer: {
    /**
     * Markup typed by a person, or produced by a model, is content — not
     * instructions for the browser. It is shown as the characters it is made
     * of, which is also the only way `Array<String>` survives being written.
     */
    html({ text }) {
      return escapeHtml(text)
    },

    link({ href, title, tokens }) {
      // parseInline, not `token.raw`: the label is markdown and has to be
      // rendered as such, and rendering it here also runs it through the
      // escaping rules above instead of splicing it in untouched.
      const text = this.parser.parseInline(tokens)
      const target = safeUrl(href)

      // A rejected target is shown rather than dropped: hiding it would leave
      // the reader with a label whose destination they cannot inspect.
      if (!target) return title ? `${text} (${escapeHtml(href)} — ${escapeHtml(title)})` : `${text} (${escapeHtml(href)})`

      const titleAttr = title ? ` title="${escapeHtml(title)}"` : ''
      return `<a href="${escapeHtml(target)}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`
    },

    image({ href, title, text }) {
      const target = safeUrl(href)
      if (!target) return escapeHtml(text || href)
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : ''
      return `<img src="${escapeHtml(target)}" alt="${escapeHtml(text ?? '')}"${titleAttr} />`
    },
  },
})

/** Block-level rendering: paragraphs, lists, code fences, quotes. */
export const renderMarkdown = value => markdown.parse(String(value ?? ''))

/** Inline rendering: one line, with the wrapping paragraph unwrapped. */
export const markedInline = value => markdown
  .parse(String(value ?? ''), { breaks: true })
  .replace(/^<p>([\s\S]*)<\/p>\n?$/, '$1')
