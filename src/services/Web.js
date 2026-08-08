import { DEFAULT_PAGE_BLOCK_KB } from '../settings/Settings'

export class Web {
  static webSearchCache = new Map()

  static pageCache = new Map()

  /**
   * A URL ends where the sentence does. The old class excluded only quotes and
   * brackets, so `https://example.com/page.` was fetched with the full stop
   * attached and answered 404. Trailing punctuation is trimmed separately
   * because a dot or a comma is legal *inside* a path and illegal at its end.
   *
   * The lookbehind keeps `blob:http://localhost/<uuid>` from yielding a
   * phantom `http://localhost/<uuid>`: the tail of a blob reference is not an
   * address, and a participant handed one would try to open it.
   */
  static URL_RE = /(?<!blob:)https?:\/\/[^\s"'<>()[\]]+/g

  static TRAILING_PUNCTUATION_RE = /[.,;:!?'"»)\]]+$/

  /**
   * References to objects that live only inside the reader's own browser.
   *
   * The reader renders each page in a headless browser, and anything that page
   * built with `URL.createObjectURL` is serialised into the markdown as
   * `blob:http://localhost/<uuid>`. Those addresses resolve nowhere once the
   * page has been fetched, and a participant shown one does not read it as
   * noise: it reports it as a technical anomaly it has discovered, which is
   * how they reached the debates as findings.
   */
  static BLOB_URL_RE = /blob:[a-z][a-z0-9+.-]*:\/\/[^\s"')\]]+/gi

  // The label pattern allows one level of nested brackets, which is what an
  // alt like `Image 3: Foto [profilo]` needs. An unbounded `[\s\S]*?` would
  // match it too, but by swallowing whatever text lay between the previous
  // bracket and this one.
  static BLOB_IMAGE_RE = /!\[(?:[^[\]]|\[[^\]]*\])*\]\(\s*blob:[^)]*\)/g

  static BLOB_LINK_RE = /\[((?:[^[\]]|\[[^\]]*\])*)\]\(\s*blob:[^)]*\)/g

  /**
   * Drops those references in every shape they arrive in — image, link, bare
   * URL — while keeping the words around them. A link keeps its label because
   * the label is text someone wrote; only the target, which leads nowhere,
   * goes.
   */
  static stripBrowserArtifacts(text) {
    return String(text ?? '')
      .replace(Web.BLOB_IMAGE_RE, '')
      .replace(Web.BLOB_LINK_RE, '$1')
      .replace(Web.BLOB_URL_RE, '')
  }

  static READER_BASE = 'https://r.jina.ai/'

  static JINA_SEARCH_BASE = 'https://s.jina.ai/'

  static DDG_SEARCH_BASE = 'https://lite.duckduckgo.com/lite/'

  static FETCH_TIMEOUT_MS = 30_000

  static SEARCH_TIMEOUT_MS = 25_000

  static MAX_SEARCH_RESULTS = 8

  static SNIPPET_MAX_CHARS = 400

  /**
   * Read settings the debate owns. The key is optional: without one the reader
   * still answers, at 20 requests a minute shared per IP; with one the ceiling
   * rises and `s.jina.ai` — which returns 401 to anonymous callers — opens up.
   */
  static config = {
    searchApiKey: '',
    pageBlockChars: DEFAULT_PAGE_BLOCK_KB * 1024,
  }

  static configure({ searchApiKey, pageBlockKb } = {}) {
    if (searchApiKey !== undefined) Web.config.searchApiKey = String(searchApiKey || '').trim()
    if (pageBlockKb !== undefined) {
      const kb = Number(pageBlockKb)
      if (Number.isFinite(kb) && kb > 0) Web.config.pageBlockChars = Math.round(kb * 1024)
    }
  }

  /**
   * The largest tool result the debate is expected to carry, so the context
   * guard can budget for it instead of cutting a page block the user asked
   * for. The margin covers the header and continuation footer `readUrl` wraps
   * around the block.
   */
  static maxToolResultChars() {
    return Web.config.pageBlockChars + 2000
  }

  static clearCaches() {
    Web.webSearchCache.clear()
    Web.pageCache.clear()
  }

  static readerHeaders(extra = {}) {
    const headers = { Accept: 'text/plain', ...extra }
    if (Web.config.searchApiKey) headers.Authorization = `Bearer ${Web.config.searchApiKey}`
    return headers
  }

  /**
   * A search result is only reusable for the query that produced it.
   *
   * The previous lookup matched in both directions on substrings, so a cached
   * "Roma" was served to "storia di Roma antica" — a different question with a
   * different answer. Normalising whitespace and case is as far as an identity
   * can stretch without changing what was asked.
   */
  static normalizeQuery(query) {
    return String(query || '').trim().toLowerCase().replace(/\s+/g, ' ')
  }

  static getCachedSearchResult(query) {
    const key = Web.normalizeQuery(query)
    if (!key || !Web.webSearchCache.has(key)) return null
    console.log(`[webSearch] cache hit: "${query}"`)
    return Web.webSearchCache.get(key)
  }

  /**
   * Removes the reader's own preamble.
   *
   * The former pattern required a second colon — `Title:` followed by `:` —
   * and therefore matched none of the headers it named, so `Title:`,
   * `URL Source:`, `Published Time:` and the cache warning all reached the
   * model as if they were page content.
   */
  static stripReaderHeaders(text) {
    return String(text ?? '')
      .replace(/^(?:Title|URL Source|Published Time|Description|Warning|Image \d+|Links\/Buttons):.*(?:\r?\n)?/gm, '')
      .replace(/^Markdown Content:\s*(?:\r?\n)?/m, '')
      .trim()
  }

  /**
   * Drops images and keeps links.
   *
   * An agent cannot follow a picture, and a page like a news homepage spends
   * thousands of characters on `![Image 31: ...](...)`. Links survive intact:
   * they are the handles the agent uses to ask for the next page.
   */
  static stripImages(text) {
    return String(text ?? '')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[\s*\]\([^)]*\)/g, '')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  static normalizeUrl(url) {
    return String(url || '').trim().replace(Web.TRAILING_PUNCTUATION_RE, '')
  }

  /**
   * The page as the reader returns it, whole.
   *
   * Nothing is cut here: the caller decides how much of it to show, and a cut
   * made at fetch time would be a cut the caller could never undo. Failures
   * are returned rather than thrown, and — unlike before — are not cached: a
   * single timeout used to make a URL permanently unreadable for the session.
   */
  static async fetchPage(url, { raw = false, noCache = false } = {}) {
    const target = Web.normalizeUrl(url)
    if (!target) return { text: '', fullLength: 0, error: 'empty URL' }

    const cacheKey = `${raw ? 'raw' : 'md'}:${target}`
    if (!noCache && Web.pageCache.has(cacheKey)) {
      console.log(`[fetchPage] cache hit: ${target}`)
      return Web.pageCache.get(cacheKey)
    }

    try {
      const response = await fetch(`${Web.READER_BASE}${target}`, {
        headers: Web.readerHeaders(noCache ? { 'x-no-cache': 'true' } : {}),
        signal: AbortSignal.timeout(Web.FETCH_TIMEOUT_MS),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const body = await response.text()
      // Applied to raw text too: a blob reference is an artefact of the
      // reader's browser, never something the page's author wrote, so there is
      // no reading of "verbatim" under which it belongs in the result.
      const cleaned = Web.stripBrowserArtifacts(body)
      const text = raw ? cleaned.trim() : Web.stripImages(Web.stripReaderHeaders(cleaned))
      const result = { text, fullLength: text.length, error: null }
      Web.pageCache.set(cacheKey, result)
      return result
    } catch (error) {
      const message = error?.message || 'unknown error'
      console.warn(`[fetchPage] failed for ${target}:`, message)
      // Deliberately not cached: a transient failure is not a property of the URL.
      return { text: '', fullLength: 0, error: message }
    }
  }

  /**
   * Cuts a page into blocks at the seams a document already has.
   *
   * A block boundary lands on a heading where one is available, then on a
   * blank line, then on any newline, and only splits mid-line when a block
   * contains no break at all. A cut through the middle of a sentence is
   * legible to nobody, and a cut through the middle of a table is worse.
   */
  static splitIntoBlocks(text, blockChars = Web.config.pageBlockChars) {
    const full = String(text ?? '')
    const size = Math.max(1000, Math.floor(blockChars) || Web.config.pageBlockChars)
    if (full.length <= size) return [full]

    const blocks = []
    let cursor = 0
    while (cursor < full.length) {
      if (full.length - cursor <= size) {
        blocks.push(full.slice(cursor))
        break
      }
      const window = full.slice(cursor, cursor + size)
      // Only accept a seam in the second half, otherwise a document whose
      // first heading sits near the top would produce a stream of tiny blocks.
      const earliestCut = Math.floor(size * 0.5)
      let cut = -1
      const heading = window.lastIndexOf('\n#')
      if (heading >= earliestCut) cut = heading + 1
      if (cut < 0) {
        const paragraph = window.lastIndexOf('\n\n')
        if (paragraph >= earliestCut) cut = paragraph + 2
      }
      if (cut < 0) {
        const line = window.lastIndexOf('\n')
        if (line >= earliestCut) cut = line + 1
      }
      if (cut < 0) cut = size
      blocks.push(full.slice(cursor, cursor + cut))
      cursor += cut
    }
    return blocks
  }

  /**
   * One page of a document, and the means to ask for the rest.
   *
   * Every outcome produces text, failures included: a page that could not be
   * read has to say so, otherwise the model fills the silence with the most
   * plausible page it can imagine and states it as observation.
   */
  static async readUrl(url, { page = 1, mode = 'markdown', blockChars } = {}) {
    const target = Web.normalizeUrl(url)
    if (!target) {
      return { text: 'No URL was provided, so nothing was read.', status: 'error', page: 1, pageCount: 0, url: '' }
    }
    if (!/^https?:\/\//i.test(target)) {
      return {
        text: `"${target}" is not an http(s) URL, so nothing was read.`,
        status: 'error',
        page: 1,
        pageCount: 0,
        url: target,
      }
    }

    const fetched = await Web.fetchPage(target, { raw: mode === 'raw' })
    if (fetched.error) {
      return {
        text: `The page ${target} could not be retrieved (${fetched.error}). Nothing about its content has been observed: do not describe it, and do not state that anything is missing from it.`,
        status: 'error',
        page: 1,
        pageCount: 0,
        url: target,
      }
    }
    if (!fetched.text.trim()) {
      return {
        text: `The page ${target} was reached but returned no readable text. Nothing about its content has been observed: do not describe it, and do not state that anything is missing from it.`,
        status: 'empty',
        page: 1,
        pageCount: 0,
        url: target,
      }
    }

    const blocks = Web.splitIntoBlocks(fetched.text, blockChars ?? Web.config.pageBlockChars)
    const pageCount = blocks.length
    const requested = Number(page)
    const index = Number.isFinite(requested) ? Math.min(Math.max(Math.trunc(requested), 1), pageCount) : 1
    const body = blocks[index - 1]

    const header = pageCount > 1
      ? `Content of ${target} — block ${index} of ${pageCount} (complete page: ${fetched.fullLength} characters).`
      : `Content of ${target} (complete page, ${fetched.fullLength} characters).`

    // The instruction rides with the block because the block is what the model
    // reasons over: what has not been shown yet is not evidence of absence.
    const footer = index < pageCount
      ? `\n\n[Block ${index} of ${pageCount}. The rest of the page has NOT been read yet — call fetch_url with the same url and page: ${index + 1} to continue. Do not conclude that anything is missing from the page on the basis of this block alone.]`
      : (pageCount > 1 ? `\n\n[End of the page: block ${index} of ${pageCount}.]` : '')

    return {
      text: `${header}\n\n${body}${footer}`,
      status: index < pageCount ? 'partial' : 'ok',
      page: index,
      pageCount,
      url: target,
    }
  }

  static extractUrls(content) {
    const matches = String(content || '').match(Web.URL_RE) || []
    return [...new Set(matches.map(Web.normalizeUrl).filter(Boolean))]
  }

  /**
   * DuckDuckGo wraps every result in a redirect whose real target sits in the
   * `uddg` parameter. Handing the wrapper to the model would make every link
   * it tries to open a second round-trip through DuckDuckGo.
   */
  static unwrapDuckDuckGoUrl(url) {
    const raw = String(url || '')
    const match = raw.match(/[?&]uddg=([^&]+)/)
    if (!match) return raw
    try {
      return decodeURIComponent(match[1])
    } catch {
      return raw
    }
  }

  /**
   * DuckDuckGo marks every matched term with its own emphasis and no spaces
   * between adjacent terms, so `**popolazione****di****Roma**` collapses to
   * `popolazionediRoma` under a naive strip. The doubled delimiter is a word
   * boundary and has to become one.
   */
  static cleanSnippet(text) {
    return String(text ?? '')
      .replace(/\*{4}/g, ' ')
      .replace(/\*{2}/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  /**
   * Reads a DuckDuckGo result page rendered as Markdown.
   *
   * Each result is `N.[title](link)` followed by the snippet and the displayed
   * host, separated by a blank line.
   */
  static parseDuckDuckGoResults(markdown, limit = Web.MAX_SEARCH_RESULTS) {
    const results = []
    const blocks = String(markdown ?? '').split(/\n\s*\n/)
    for (const block of blocks) {
      const lines = block.split('\n').map(line => line.trim()).filter(Boolean)
      if (lines.length === 0) continue
      const head = lines[0].match(/^\d+\.\s*\[(.+?)\]\((\S+?)\)$/)
      if (!head) continue

      const title = Web.cleanSnippet(head[1])
      const url = Web.unwrapDuckDuckGoUrl(head[2])
      if (!url.startsWith('http')) continue

      // The last line is the host DuckDuckGo prints under the result; the
      // lines between it and the title are the snippet.
      const rest = lines.slice(1)
      const snippetLines = rest.length > 1 ? rest.slice(0, -1) : rest
      const snippet = Web.cleanSnippet(snippetLines.join(' ')).slice(0, Web.SNIPPET_MAX_CHARS)

      results.push({ title, url, snippet })
      if (results.length >= limit) break
    }
    return results
  }

  static formatResults(query, results) {
    const lines = results.map((result, index) => {
      const snippet = result.snippet ? `\n   ${result.snippet}` : ''
      return `${index + 1}. ${result.title}\n   ${result.url}${snippet}`
    })
    return [
      `Web results for "${query}" (${results.length}):`,
      lines.join('\n\n'),
      'These are search results, not page contents. To read one of them, call fetch_url with its URL.',
    ].join('\n\n')
  }

  /**
   * DuckDuckGo, read through the same reader used for pages.
   *
   * Requested directly, `lite.duckduckgo.com` answers 403 to a browser; routed
   * through the reader it answers with the result list. This is the keyless
   * path and the default one.
   */
  static async searchViaDuckDuckGo(query) {
    const serpUrl = `${Web.DDG_SEARCH_BASE}?q=${encodeURIComponent(query)}`
    const response = await fetch(`${Web.READER_BASE}${serpUrl}`, {
      headers: Web.readerHeaders(),
      signal: AbortSignal.timeout(Web.SEARCH_TIMEOUT_MS),
    })
    if (!response.ok) throw new Error(`DuckDuckGo HTTP ${response.status}`)

    const markdown = Web.stripBrowserArtifacts(Web.stripReaderHeaders(await response.text()))
    return Web.parseDuckDuckGoResults(markdown)
  }

  /**
   * The keyed path. `s.jina.ai` returns 401 without a key, which is why the
   * previous fallback had stopped producing anything at all.
   */
  static async searchViaJina(query) {
    const response = await fetch(`${Web.JINA_SEARCH_BASE}?q=${encodeURIComponent(query)}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${Web.config.searchApiKey}`,
        'X-Respond-With': 'no-content',
      },
      signal: AbortSignal.timeout(Web.SEARCH_TIMEOUT_MS),
    })
    if (!response.ok) throw new Error(`Jina search HTTP ${response.status}`)

    const payload = await response.json()
    const entries = Array.isArray(payload?.data) ? payload.data : []
    return entries
      .filter(entry => typeof entry?.url === 'string' && entry.url.startsWith('http'))
      .slice(0, Web.MAX_SEARCH_RESULTS)
      .map(entry => ({
        title: Web.cleanSnippet(entry.title || entry.url),
        url: entry.url,
        snippet: Web.cleanSnippet(entry.description || entry.content || '').slice(0, Web.SNIPPET_MAX_CHARS),
      }))
  }

  /**
   * A list of results, never a page dump.
   *
   * The old implementation appended a whole clipped page to every answer —
   * 25.216 characters for a one-line question. Deciding which result is worth
   * opening belongs to the model, and opening it is what `fetch_url` is for.
   */
  static async search(query, { noResultsMessage } = {}) {
    const key = Web.normalizeQuery(query)
    if (!key) return noResultsMessage ?? `No results for: ${query}`

    const cached = Web.getCachedSearchResult(query)
    if (cached) return cached

    const attempts = Web.config.searchApiKey
      ? [['jina', () => Web.searchViaJina(query)], ['duckduckgo', () => Web.searchViaDuckDuckGo(query)]]
      : [['duckduckgo', () => Web.searchViaDuckDuckGo(query)]]

    const failures = []
    for (const [name, run] of attempts) {
      try {
        const results = await run()
        if (results.length > 0) {
          console.log(`[webSearch] ${name}: ${results.length} results for "${query}"`)
          const formatted = Web.formatResults(query, results)
          Web.webSearchCache.set(key, formatted)
          return formatted
        }
        failures.push(`${name}: no results`)
      } catch (error) {
        const message = error?.message || 'unknown error'
        console.warn(`[webSearch] ${name} failed for "${query}":`, message)
        failures.push(`${name}: ${message}`)
      }
    }

    // An empty result set is a fact about the query; a failed backend is not.
    // Telling them apart is what stops the model from reporting "nothing
    // exists" when the truth is "nothing was asked".
    const onlyEmpty = failures.every(failure => failure.endsWith('no results'))
    if (onlyEmpty) return noResultsMessage ?? `No results for: ${query}`
    return `Web search unavailable for "${query}" (${failures.join('; ')}). No search was performed: do not treat this as evidence that nothing exists on the subject.`
  }
}
