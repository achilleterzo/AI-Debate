import { describe, expect, it } from 'vitest'
import { escapeHtml, markedInline, renderMarkdown } from '../src/utils/Markdown'
import { renderMessageMarkdown } from '../src/utils/MessageMarkdown'

const RENDERERS = [
  ['block', renderMarkdown],
  ['inline', markedInline],
  ['message', renderMessageMarkdown],
]

/**
 * Tags that must never be built out of message text, whatever wrote it.
 *
 * Matching on words like `onerror` is not a test: escaped, the word is inert
 * text and appears in the output on purpose. Only a real tag is a failure.
 */
const FORBIDDEN_TAG = /<(?:script|iframe|svg|form|input|style|object|embed|link|body|meta|img)[\s/>]/i

describe('raw HTML is content, not markup', () => {
  const payloads = {
    'image with an error handler': '<img src=x onerror="alert(1)">',
    'script element': '<script>alert(document.cookie)</script>',
    'svg with a load handler': '<svg onload=alert(1)>',
    'framed third party': '<iframe src="https://evil.example"></iframe>',
    'anchor written by hand': '<a href="javascript:alert(1)">x</a>',
    'form posting elsewhere': '<form action="https://evil.example"><input name=p></form>',
    'style block': '<style>body{background:url("https://evil.example/b")}</style>',
  }

  for (const [name, payload] of Object.entries(payloads)) {
    for (const [mode, render] of RENDERERS) {
      it(`${mode}: ${name} is escaped`, () => {
        const out = render(payload)
        expect(out).not.toMatch(FORBIDDEN_TAG)
        expect(out).not.toContain(payload)
        // Present as text, so the reader still sees what was written.
        expect(out).toContain('&lt;')
      })
    }
  }
})

describe('angle brackets survive being written', () => {
  // Not only a security question: this text used to vanish from the chat,
  // swallowed as an unknown tag.
  it('keeps a generic type visible', () => {
    expect(renderMessageMarkdown('Array<String> vs List<int>'))
      .toContain('Array&lt;String&gt; vs List&lt;int&gt;')
  })

  it('keeps a comparison visible', () => {
    expect(renderMessageMarkdown('Se a < b e b > c allora...'))
      .toContain('a &lt; b e b &gt; c')
  })
})

describe('links point somewhere a browser may go', () => {
  const rejected = {
    'javascript scheme': '[click](javascript:alert(1))',
    'data document': '[x](data:text/html,<script>alert(1)</script>)',
    'vbscript scheme': '[x](vbscript:msgbox)',
  }

  for (const [name, payload] of Object.entries(rejected)) {
    it(`refuses a ${name}`, () => {
      const out = renderMarkdown(payload)
      expect(out).not.toMatch(/<a\s/i)
      // The target is shown rather than dropped: a label whose destination
      // cannot be inspected is worse than a visible refusal.
      expect(out).toMatch(/javascript:|data:|vbscript:/)
    })
  }

  it('keeps an ordinary link clickable and safe to open', () => {
    const out = renderMarkdown('[example](https://example.com)')
    expect(out).toContain('href="https://example.com"')
    expect(out).toContain('rel="noopener noreferrer"')
  })

  // The title was interpolated unescaped, which turned a quote in it into a
  // live event handler attribute.
  it('cannot break out of the title attribute', () => {
    const out = renderMarkdown('[x](https://ok.it "a\\" onmouseover=\\"alert(1)")')
    // The quote stays inside the attribute as an entity, so the parser never
    // sees a second attribute. Interpolated raw, it opened an event handler.
    expect(out).toContain('title="a&quot; onmouseover=&quot;alert(1)"')
    expect(out).not.toMatch(/"\s+onmouseover=/i)
  })

  // The label used to be spliced in as its raw source text.
  it('renders markdown inside the label instead of showing its source', () => {
    const out = renderMarkdown('[text **bold**](https://ok.it)')
    expect(out).toContain('<strong>bold</strong>')
    expect(out).not.toContain('**bold**')
  })

  it('escapes an ampersand in a query string', () => {
    expect(renderMarkdown('[x](https://ok.it?a=1&b=2)')).toContain('href="https://ok.it?a=1&amp;b=2"')
  })

  it('refuses an image pointing at a script scheme', () => {
    const out = renderMarkdown('![alt](javascript:alert(1))')
    expect(out).not.toMatch(/<img/i)
    expect(out).toContain('alt')
  })
})

describe('ordinary markdown still renders', () => {
  const cases = [
    ['emphasis', 'Testo **grassetto** e *corsivo*', /<strong>grassetto<\/strong>.*<em>corsivo<\/em>/s],
    ['inline code', 'valore `x = 1`', /<code>x = 1<\/code>/],
    ['list', '- primo\n- secondo', /<ul>[\s\S]*<li>primo<\/li>/],
    ['quote', '> citazione', /<blockquote>/],
    ['heading', '## Titolo', /<h2>Titolo<\/h2>/],
    ['table', '| a | b |\n|---|---|\n| 1 | 2 |', /<table>/],
  ]

  for (const [name, input, expected] of cases) {
    it(`renders ${name}`, () => {
      expect(renderMarkdown(input)).toMatch(expected)
    })
  }

  it('escapes the angle brackets inside a fenced block', () => {
    expect(renderMarkdown('```js\nconst a = 1 < 2\n```')).toContain('1 &lt; 2')
  })
})

describe('escapeHtml', () => {
  it('covers every character that can end an attribute or open a tag', () => {
    expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;')
  })

  it('treats null and undefined as the empty string', () => {
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
  })
})
