export class Web {
  static webSearchCache = new Map()

  static pageCache = new Map()

  static urlSummaryCache = new Map()

  static URL_RE = /https?:\/\/[^\s"'<>)]+/g

  static WEB_SEARCH_TOOL = {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web for up-to-date information to better answer the question.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query in English or Italian' },
        },
        required: ['query'],
      },
    },
  }

  static clearCaches() {
    Web.webSearchCache.clear()
    Web.pageCache.clear()
    Web.urlSummaryCache.clear()
  }

  static getCachedSearchResult(query) {
    if (Web.webSearchCache.has(query)) {
      console.log(`[webSearch] cache hit (exact): "${query}"`)
      return Web.webSearchCache.get(query)
    }

    const loweredQuery = query.toLowerCase()
    for (const [cachedQuery, cachedResult] of Web.webSearchCache) {
      const loweredCachedQuery = cachedQuery.toLowerCase()
      if (loweredQuery.includes(loweredCachedQuery) || loweredCachedQuery.includes(loweredQuery)) {
        console.log(`[webSearch] cache hit (pertinenza): "${query}" ~ "${cachedQuery}"`)
        return cachedResult
      }
    }

    return null
  }

  static async fetchPage(url, maxChars = 6000) {
    if (Web.pageCache.has(url)) {
      console.log(`[fetchPage] cache hit: ${url}`)
      return Web.pageCache.get(url)
    }

    try {
      const response = await fetch(`https://r.jina.ai/${url}`, {
        headers: { Accept: 'text/plain' },
        signal: AbortSignal.timeout(10_000),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      let text = await response.text()
      text = text.replace(/^(Title:|URL:|Published|Description):.*\n?/gm, '').trim()
      if (text.length > maxChars) text = `${text.slice(0, maxChars)}...`
      Web.pageCache.set(url, text)
      return text
    } catch (error) {
      console.warn(`[fetchPage] fallito per ${url}:`, error.message)
      return null
    }
  }

  static async fetchAndSummarizePage(url, { summarizePage }) {
    if (Web.urlSummaryCache.has(url)) {
      console.log(`[urlSummary] cache hit: ${url}`)
      return Web.urlSummaryCache.get(url)
    }

    const promise = (async () => {
      const raw = await Web.fetchPage(url)
      if (!raw) return null

      try {
        const summary = (await summarizePage(raw)).trim() || raw.slice(0, 800)
        console.log(`[urlSummary] summarized: ${url}`)
        return summary
      } catch (error) {
        console.warn(`[urlSummary] fallback to raw for ${url}:`, error.message)
        return raw.slice(0, 800)
      }
    })()

    Web.urlSummaryCache.set(url, promise)
    return promise
  }

  static extractUrls(content) {
    return [...new Set((String(content || '').match(Web.URL_RE) || []))]
  }

  static tokenizeQuery(query) {
    return [...new Set(
      String(query || '')
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .map(token => token.trim())
        .filter(token => token.length >= 3),
    )]
  }

  static buildRelevantExcerpt(text, tokens, maxChars = 1200) {
    const normalized = String(text || '')
    if (!normalized.trim()) return ''

    const lowered = normalized.toLowerCase()
    let matchIndex = -1
    for (const token of tokens) {
      matchIndex = lowered.indexOf(token)
      if (matchIndex >= 0) break
    }

    if (matchIndex < 0) return normalized.slice(0, maxChars)

    const start = Math.max(0, matchIndex - Math.floor(maxChars * 0.25))
    const end = Math.min(normalized.length, start + maxChars)
    const prefix = start > 0 ? '... ' : ''
    const suffix = end < normalized.length ? ' ...' : ''
    return `${prefix}${normalized.slice(start, end).trim()}${suffix}`
  }

  static async searchTopicSources(query, { sourceUrls = [] }) {
    const urls = [...new Set(sourceUrls.filter(Boolean))]
    if (urls.length === 0) return null

    const tokens = Web.tokenizeQuery(query)
    if (tokens.length === 0) return null

    for (const sourceUrl of urls) {
      const sourceText = await Web.fetchPage(sourceUrl, 12000)
      if (!sourceText) continue

      const loweredSource = sourceText.toLowerCase()
      const sourceHits = tokens.filter(token => loweredSource.includes(token)).length
      if (sourceHits >= Math.min(2, tokens.length)) {
        const excerpt = Web.buildRelevantExcerpt(sourceText, tokens)
        return `**Primary source context** (${sourceUrl}):\n${excerpt}`
      }

      const linkedUrls = Web.extractUrls(sourceText)
      const rankedLinks = linkedUrls
        .map(url => ({
          url,
          score: tokens.filter(token => url.toLowerCase().includes(token)).length,
        }))
        .filter(entry => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 2)

      for (const entry of rankedLinks) {
        const linkedText = await Web.fetchPage(entry.url, 6000)
        if (!linkedText) continue
        const loweredLinked = linkedText.toLowerCase()
        const linkedHits = tokens.filter(token => loweredLinked.includes(token)).length
        if (linkedHits >= Math.min(2, tokens.length)) {
          const excerpt = Web.buildRelevantExcerpt(linkedText, tokens, 1000)
          return `**Context from source-linked page** (${entry.url}):\n${excerpt}`
        }
      }
    }

    return null
  }

  static async search(query, { noResultsMessage }) {
    const cachedResult = Web.getCachedSearchResult(query)
    if (cachedResult) return cachedResult

    try {
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1&skip_disambig=1`
      const response = await fetch(url)
      if (!response.ok) throw new Error(`DDG HTTP ${response.status}`)
      const data = await response.json()

      const parts = []

      if (data.AbstractText) {
        parts.push(`**Sommario**: ${data.AbstractText}`)
        if (data.AbstractSource) parts.push(`(fonte: ${data.AbstractSource})`)
      }

      if (data.Answer) {
        parts.push(`**Risposta diretta**: ${data.Answer}`)
      }

      const topics = [...(data.RelatedTopics ?? [])].slice(0, 4)
      const bullets = topics
        .filter(topic => topic.Text)
        .map(topic => `- ${topic.Text}`)
      if (bullets.length) parts.push(`**Argomenti correlati**:\n${bullets.join('\n')}`)

      const urls = []
      if (data.AbstractURL) urls.push(data.AbstractURL)
      for (const topic of (data.RelatedTopics ?? [])) {
        if (topic.FirstURL && topic.FirstURL.startsWith('http')) urls.push(topic.FirstURL)
      }

      if (urls.length > 0) {
        const pageUrl = urls[0]
        console.log(`[webSearch] navigazione: ${pageUrl}`)
        const pageContent = await Web.fetchPage(pageUrl)
        if (pageContent) parts.push(`**Contenuto pagina** (${pageUrl}):\n${pageContent}`)
      }

      if (parts.length === 0) {
        const fallbackResult = await Web.searchViaJina(query)
        if (!fallbackResult) return noResultsMessage
        Web.webSearchCache.set(query, fallbackResult)
        return fallbackResult
      }
      const result = parts.join('\n\n')
      Web.webSearchCache.set(query, result)
      return result
    } catch (error) {
      try {
        const fallbackResult = await Web.searchViaJina(query)
        if (fallbackResult) {
          Web.webSearchCache.set(query, fallbackResult)
          return fallbackResult
        }
      } catch {
        // Fall through to final error response.
      }
      return `Web search not available: ${error.message}`
    }
  }

  static async searchViaJina(query, maxChars = 5000) {
    try {
      const response = await fetch(`https://s.jina.ai/${encodeURIComponent(query)}`, {
        headers: { Accept: 'text/plain' },
        signal: AbortSignal.timeout(12_000),
      })
      if (!response.ok) throw new Error(`Jina search HTTP ${response.status}`)

      let text = await response.text()
      text = text.replace(/^(Title:|URL:|Published|Description):.*\n?/gm, '').trim()
      if (!text) return null
      if (text.length > maxChars) text = `${text.slice(0, maxChars)}...`
      return `**Web results**:\n${text}`
    } catch (error) {
      console.warn(`[webSearch] fallback search failed for "${query}":`, error.message)
      return null
    }
  }
}
