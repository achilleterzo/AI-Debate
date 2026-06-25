import { marked } from 'marked'

const renderer = new marked.Renderer()
renderer.link = ({ href, title, tokens }) => {
  const text = tokens.map(token => token.raw).join('')
  const titleAttr = title ? ` title="${title}"` : ''
  return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`
}

marked.setOptions({ renderer })

export const markedInline = value => marked.parse(value || '', { breaks: true }).replace(/^<p>([\s\S]*)<\/p>\n?$/, '$1')
