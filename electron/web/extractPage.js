/**
 * Runs inside the page (serialized with toString): the rendered DOM as
 * Markdown-ish text, or the whole visible text when `raw`.
 */
export function extractRenderedPage(raw) {
  const source = document.querySelector('article, main, [role="main"]') || document.body
  if (!source) return { text: '', title: document.title || '', url: location.href }
  if (raw) return { text: document.body?.innerText || document.body?.textContent || '', title: document.title || '', url: location.href }

  const root = source.cloneNode(true)
  root.querySelectorAll('script,style,noscript,svg,canvas,picture,video,audio,iframe,form,input,button,select,textarea,nav,footer,aside,[aria-hidden="true"]').forEach(node => node.remove())

  root.querySelectorAll('a[href]').forEach(anchor => {
    const label = (anchor.textContent || '').replace(/\s+/g, ' ').trim()
    let href = ''
    try { href = new URL(anchor.getAttribute('href'), document.baseURI).href } catch { /* malformed link */ }
    anchor.replaceWith(document.createTextNode(label && /^https?:/i.test(href) ? `[${label}](${href})` : label))
  })
  root.querySelectorAll('pre').forEach(node => {
    node.replaceWith(document.createTextNode(`\n\`\`\`\n${node.textContent || ''}\n\`\`\`\n`))
  })
  root.querySelectorAll('br').forEach(node => node.replaceWith(document.createTextNode('\n')))
  root.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(node => {
    const level = Number(node.tagName.slice(1)) || 2
    node.prepend(document.createTextNode(`\n${'#'.repeat(level)} `))
    node.append(document.createTextNode('\n'))
  })
  root.querySelectorAll('li').forEach(node => {
    node.prepend(document.createTextNode('\n- '))
    node.append(document.createTextNode('\n'))
  })
  root.querySelectorAll('blockquote').forEach(node => {
    node.prepend(document.createTextNode('\n> '))
    node.append(document.createTextNode('\n'))
  })
  root.querySelectorAll('p,div,section,article,main,header,tr').forEach(node => node.append(document.createTextNode('\n')))

  const body = (root.textContent || '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  const title = (document.title || '').trim()
  return { text: title && !body.startsWith(`# ${title}`) ? `# ${title}\n\n${body}` : body, title, url: location.href }
}

