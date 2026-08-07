import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Web } from '../src/services/Web'
import { dropDuplicateNames } from '../src/hooks/useDebateWizard'

const FOOTER = 'About Us · Privacy Policy · Cookie Policy · Code of Ethics'

function page({ head = 'HEAD', filler = 'x', length = 40000, footer = FOOTER } = {}) {
  const middle = filler.repeat(Math.max(0, length - head.length - footer.length))
  return `${head}${middle}${footer}`
}

function stubFetch(impl) {
  vi.stubGlobal('fetch', vi.fn(impl))
}

function textResponse(body, { ok = true, status = 200 } = {}) {
  return { ok, status, text: async () => body, json: async () => JSON.parse(body) }
}

beforeEach(() => {
  Web.clearCaches()
  Web.configure({ searchApiKey: '', pageBlockKb: 16 })
})

afterEach(() => {
  vi.unstubAllGlobals()
  Web.clearCaches()
  Web.configure({ searchApiKey: '', pageBlockKb: 16 })
})

describe('stripReaderHeaders', () => {
  // The former pattern required a second colon and therefore matched none of
  // the headers it named, so all of them reached the model as page content.
  it('removes the reader preamble the old pattern silently kept', () => {
    const raw = [
      'Title: Example Domain',
      '',
      'URL Source: https://example.com/',
      '',
      'Published Time: Sat, 01 Aug 2026 09:39:03 GMT',
      '',
      'Warning: This is a cached snapshot of the original page.',
      '',
      'Markdown Content:',
      'The body of the page.',
    ].join('\n')

    expect(Web.stripReaderHeaders(raw)).toBe('The body of the page.')
  })

  it('leaves a body line that merely contains a colon alone', () => {
    expect(Web.stripReaderHeaders('Conclusion: the tax rose by 4%.')).toBe('Conclusion: the tax rose by 4%.')
  })
})

describe('stripImages', () => {
  it('drops images and keeps the links an agent can follow', () => {
    const markdown = '![Image 3: Logo](https://cdn.example.com/logo.svg)\n[Contacts](https://example.com/contacts)'
    const cleaned = Web.stripImages(markdown)
    expect(cleaned).not.toContain('logo.svg')
    expect(cleaned).toContain('[Contacts](https://example.com/contacts)')
  })

  it('removes a link left with no text once its image is gone', () => {
    expect(Web.stripImages('[![Image 1: Logo](a.svg)](https://example.com/)')).toBe('')
  })
})

/**
 * The reader renders pages in a browser of its own, and objects that page
 * created with `URL.createObjectURL` come back as `blob:http://localhost/...`.
 * Participants were reporting those as technical anomalies they had found.
 */
describe('stripBrowserArtifacts', () => {
  const cases = {
    'a plain image': '![Image 3: Foto](blob:http://localhost/abc123)',
    // The alt text is what carried the reference past the earlier pattern:
    // a bracket inside it stopped the image from matching at all.
    'an image whose alt contains brackets': '![Image 3: Foto [profilo]](blob:http://localhost/abc123)',
    'a blob over https': '![i](blob:https://example.com/uuid-9)',
    'a bare reference in prose': 'La risorsa e blob:http://localhost/abc123 e non e raggiungibile.',
  }

  for (const [name, payload] of Object.entries(cases)) {
    it(`removes ${name}`, () => {
      expect(Web.stripBrowserArtifacts(payload)).not.toMatch(/blob:[a-z]+:\/\//i)
    })
  }

  it('keeps the label of a link whose target leads nowhere', () => {
    expect(Web.stripBrowserArtifacts('[Profilo](blob:http://localhost/abc123)')).toBe('Profilo')
  })

  it('leaves prose that merely talks about blob URLs alone', () => {
    const sentence = 'Un Blob URL si crea con URL.createObjectURL(blob:).'
    expect(Web.stripBrowserArtifacts(sentence)).toBe(sentence)
  })

  it('does not touch real links and images', () => {
    const markdown = '[Sito](https://example.com/pagina) ![Logo](https://cdn.example.com/l.png)'
    expect(Web.stripBrowserArtifacts(markdown)).toBe(markdown)
  })

  it('strips the reference from raw text too, where nothing else would', async () => {
    stubFetch(async () => textResponse('Markdown Content:\n![Image 1: Profile](blob:http://localhost/deadbeef)'))
    for (const mode of ['markdown', 'raw']) {
      Web.clearCaches()
      const result = await Web.readUrl('https://example.com/', { mode })
      expect(result.text).not.toContain('blob:')
    }
  })
})

describe('extractUrls', () => {
  // A blob reference ends in something shaped like an address but which opens
  // nothing; extracting it handed participants a URL to chase.
  it('finds no address inside a blob reference', () => {
    expect(Web.extractUrls('Vedi ![x](blob:http://localhost/c204bf19f78776c25) qui')).toEqual([])
  })

  // `https://example.com/page.` was fetched with the full stop attached.
  it('stops a URL at the punctuation that ends the sentence', () => {
    expect(Web.extractUrls('See https://example.com/page. Also (https://foo.it/a), and https://bar.it/b.')).toEqual([
      'https://example.com/page',
      'https://foo.it/a',
      'https://bar.it/b',
    ])
  })
})

describe('splitIntoBlocks', () => {
  it('leaves a page shorter than one block whole', () => {
    expect(Web.splitIntoBlocks('short page', 16384)).toEqual(['short page'])
  })

  it('reaches the footer, which is where a site declares who and what it is', () => {
    const blocks = Web.splitIntoBlocks(page(), 16384)
    expect(blocks.length).toBeGreaterThan(1)
    expect(blocks[0]).toContain('HEAD')
    // The old head-only cut dropped exactly this, and the debate then reported
    // the pages as non-existent.
    expect(blocks[blocks.length - 1]).toContain('Code of Ethics')
  })

  it('loses nothing: the blocks rejoin into the original page', () => {
    const original = page({ length: 50000 })
    expect(Web.splitIntoBlocks(original, 16384).join('')).toBe(original)
  })

  it('cuts on a heading rather than through a sentence', () => {
    const section = paragraph => `${paragraph}\n\n`.repeat(80)
    const document = `# One\n\n${section('a'.repeat(60))}## Two\n\n${section('b'.repeat(60))}`
    const blocks = Web.splitIntoBlocks(document, 2000)
    expect(blocks.length).toBeGreaterThan(1)
    for (const block of blocks.slice(1)) {
      expect(block.startsWith('#') || block.startsWith('a') || block.startsWith('b')).toBe(true)
    }
  })
})

describe('readUrl', () => {
  it('says a page could not be read instead of staying silent about it', async () => {
    stubFetch(async () => { throw new Error('Failed to fetch') })
    const result = await Web.readUrl('https://example.com/')
    expect(result.status).toBe('error')
    expect(result.text).toContain('could not be retrieved')
    expect(result.text).toContain('Failed to fetch')
    expect(result.text).toMatch(/do not state that anything is missing/i)
  })

  it('reports an HTTP failure with its status', async () => {
    stubFetch(async () => textResponse('', { ok: false, status: 429 }))
    const result = await Web.readUrl('https://example.com/')
    expect(result.status).toBe('error')
    expect(result.text).toContain('HTTP 429')
  })

  // A failure is not a property of the URL: caching it used to make one
  // timeout permanently fatal for the rest of the session.
  it('does not cache a failure, so a retry can still succeed', async () => {
    let call = 0
    stubFetch(async () => {
      call += 1
      if (call === 1) throw new Error('timeout')
      return textResponse('Markdown Content:\nThe page came back.')
    })

    expect((await Web.readUrl('https://example.com/')).status).toBe('error')
    const retry = await Web.readUrl('https://example.com/')
    expect(retry.status).toBe('ok')
    expect(retry.text).toContain('The page came back.')
  })

  it('flags an empty page rather than passing empty content along', async () => {
    stubFetch(async () => textResponse('   '))
    const result = await Web.readUrl('https://example.com/')
    expect(result.status).toBe('empty')
    expect(result.text).toMatch(/no readable text/i)
  })

  it('returns the whole page in one block when it fits', async () => {
    stubFetch(async () => textResponse('Markdown Content:\nA complete little page.'))
    const result = await Web.readUrl('https://example.com/')
    expect(result.status).toBe('ok')
    expect(result.pageCount).toBe(1)
    expect(result.text).toContain('A complete little page.')
    expect(result.text).not.toContain('call fetch_url')
  })

  it('tells the reader how to reach the part it has not seen', async () => {
    stubFetch(async () => textResponse(page({ length: 40000 })))
    const result = await Web.readUrl('https://example.com/')
    expect(result.status).toBe('partial')
    expect(result.pageCount).toBeGreaterThan(1)
    expect(result.text).toContain('page: 2')
    expect(result.text).toMatch(/has NOT been read yet/i)
  })

  it('serves the requested block and marks the last one as the end', async () => {
    stubFetch(async () => textResponse(page({ length: 40000 })))
    const first = await Web.readUrl('https://example.com/')
    const last = await Web.readUrl('https://example.com/', { page: first.pageCount })
    expect(last.page).toBe(first.pageCount)
    expect(last.status).toBe('ok')
    expect(last.text).toContain('End of the page')
    expect(last.text).toContain('Code of Ethics')
  })

  it('clamps a block number past the end instead of returning nothing', async () => {
    stubFetch(async () => textResponse('Markdown Content:\nOne short page.'))
    const result = await Web.readUrl('https://example.com/', { page: 99 })
    expect(result.page).toBe(1)
    expect(result.text).toContain('One short page.')
  })

  it('refuses a value that is not an http URL', async () => {
    stubFetch(async () => textResponse('should never be requested'))
    const result = await Web.readUrl('file:///etc/passwd')
    expect(result.status).toBe('error')
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('keeps links in markdown mode so the agent can follow them', async () => {
    stubFetch(async () => textResponse('Markdown Content:\n[Contacts](https://example.com/contacts)'))
    const result = await Web.readUrl('https://example.com/')
    expect(result.text).toContain('[Contacts](https://example.com/contacts)')
  })

  it('leaves the reader preamble in place in raw mode', async () => {
    stubFetch(async () => textResponse('Title: Example\n\nMarkdown Content:\nBody.'))
    const result = await Web.readUrl('https://example.com/', { mode: 'raw' })
    expect(result.text).toContain('Title: Example')
  })
})

describe('parseDuckDuckGoResults', () => {
  const serp = [
    '1.[First result — Comune di Roma](https://duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.comune.roma.it%2Fpage&rut=abc)',
    "L'età media della **popolazione****di****Roma** è pari a 47,1 anni.",
    'www.comune.roma.it/page',
    '',
    '2.[Second result](https://duckduckgo.com/l/?uddg=https%3A%2F%2Ftuttitalia.it%2Froma&rut=def)',
    'Dati ISTAT.',
    'tuttitalia.it/roma',
  ].join('\n')

  it('unwraps the DuckDuckGo redirect into the real target', () => {
    const results = Web.parseDuckDuckGoResults(serp)
    expect(results.map(result => result.url)).toEqual([
      'https://www.comune.roma.it/page',
      'https://tuttitalia.it/roma',
    ])
  })

  // DuckDuckGo emphasises every matched term with no space between adjacent
  // ones, so a naive strip produced `popolazionediRoma`.
  it('restores the spaces that the emphasis markers stand in for', () => {
    const [first] = Web.parseDuckDuckGoResults(serp)
    expect(first.snippet).toContain('popolazione di Roma')
    expect(first.snippet).not.toContain('*')
  })

  it('ignores lines that are not results', () => {
    expect(Web.parseDuckDuckGoResults('Some heading\n\nNo results found.')).toEqual([])
  })

  it('honours the result limit', () => {
    expect(Web.parseDuckDuckGoResults(serp, 1)).toHaveLength(1)
  })
})

describe('search', () => {
  const serp = [
    'Title: q at DuckDuckGo',
    '',
    'Markdown Content:',
    '1.[A result](https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fa&rut=x)',
    'A snippet.',
    'example.com/a',
  ].join('\n')

  it('returns a list of results, not a page dump', async () => {
    stubFetch(async () => textResponse(serp))
    const result = await Web.search('a query')
    expect(result).toContain('https://example.com/a')
    expect(result).toContain('A snippet.')
    expect(result).toContain('call fetch_url')
    // The old implementation appended a whole clipped page to every answer.
    expect(result.length).toBeLessThan(1000)
  })

  it('routes the search through the reader, which is what makes it answer', async () => {
    stubFetch(async () => textResponse(serp))
    await Web.search('a query')
    const [url] = globalThis.fetch.mock.calls[0]
    expect(url).toContain('r.jina.ai')
    expect(url).toContain('lite.duckduckgo.com')
  })

  it('sends no Authorization header when no key is configured', async () => {
    stubFetch(async () => textResponse(serp))
    await Web.search('a query')
    const [, init] = globalThis.fetch.mock.calls[0]
    expect(init.headers.Authorization).toBeUndefined()
  })

  it('prefers the keyed backend when a key is configured', async () => {
    Web.configure({ searchApiKey: 'jina_test' })
    stubFetch(async () => textResponse(JSON.stringify({
      data: [{ title: 'Keyed result', url: 'https://example.com/keyed', description: 'From the keyed backend.' }],
    })))
    const result = await Web.search('a query')
    const [url, init] = globalThis.fetch.mock.calls[0]
    expect(url).toContain('s.jina.ai')
    expect(init.headers.Authorization).toBe('Bearer jina_test')
    expect(result).toContain('https://example.com/keyed')
  })

  it('falls back to the keyless backend when the keyed one fails', async () => {
    Web.configure({ searchApiKey: 'jina_test' })
    let call = 0
    stubFetch(async () => {
      call += 1
      if (call === 1) return textResponse('', { ok: false, status: 401 })
      return textResponse(serp)
    })
    const result = await Web.search('a query')
    expect(result).toContain('https://example.com/a')
  })

  // "Nothing was found" and "nothing was asked" are different facts, and only
  // the first one is evidence about the world.
  it('distinguishes an empty result set from a broken backend', async () => {
    stubFetch(async () => textResponse('Markdown Content:\nNo results.'))
    expect(await Web.search('nothing at all', { noResultsMessage: 'NO-RESULTS' })).toBe('NO-RESULTS')

    Web.clearCaches()
    stubFetch(async () => { throw new Error('Failed to fetch') })
    const broken = await Web.search('another query', { noResultsMessage: 'NO-RESULTS' })
    expect(broken).toContain('unavailable')
    expect(broken).toMatch(/do not treat this as evidence/i)
  })

  // The old lookup matched substrings in both directions, so a cached "Roma"
  // was served to "storia di Roma antica" — a different question.
  it('reuses a cached result only for the same question', async () => {
    stubFetch(async () => textResponse(serp))
    await Web.search('Roma')
    expect(Web.getCachedSearchResult('  roma  ')).not.toBeNull()
    expect(Web.getCachedSearchResult('storia di Roma antica')).toBeNull()
  })
})

describe('dropDuplicateNames', () => {
  it('seats one persona per name, keeping the first', () => {
    const drafts = [
      { name: 'Elena Valenti', traits: ['moderator'] },
      { name: 'Marco Riva', traits: [] },
      { name: 'elena  valenti', traits: ['debater'] },
    ]
    expect(dropDuplicateNames(drafts).map(draft => draft.name)).toEqual(['Elena Valenti', 'Marco Riva'])
    expect(dropDuplicateNames(drafts)[0].traits).toEqual(['moderator'])
  })

  it('drops nameless drafts, which cannot be told apart at all', () => {
    expect(dropDuplicateNames([{ name: '  ' }, { name: 'Sofia' }]).map(d => d.name)).toEqual(['Sofia'])
  })
})
