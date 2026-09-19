/**
 * Reading a search result page, split in two halves.
 *
 * `collectSerpCandidates` runs inside the page (serialized with toString), so
 * it cannot see this module: it only gathers raw candidates and knows nothing
 * about engines beyond the selectors it is handed as JSON. Everything that
 * takes judgement — redirect unwrapping, engine-owned links, de-duplication,
 * challenge detection — happens in `readSerp`, in Node, where it is testable.
 */

export const MAX_RESULTS = 8
const MAX_CANDIDATES_PER_TIER = 200
const SNIPPET_MAX_CHARS = 400
const GENERIC_CHALLENGE = /unusual traffic|not a robot|captcha|before you continue/i

/**
 * Candidates come in tiers of decreasing trust:
 * - primary: the engine's own result containers;
 * - heading: any linked H3, which survives class-name rotations;
 * - anchor: any visible link, the last semantic signal left.
 * A later tier is only consulted when every earlier one produced nothing,
 * so fallback links never pad out a page of real results.
 */
export const TIERS = ['primary', 'heading', 'anchor']

export function collectSerpCandidates(spec, maxPerTier) {
  const text = node => (node?.textContent || '').replace(/\s+/g, ' ').trim()
  const first = (root, selectors) => {
    for (const selector of selectors || []) {
      const node = root.querySelector(selector)
      if (node) return node
    }
    return null
  }
  const describe = tier => container => {
    const titleNode = first(container, spec.title)
    const anchor = titleNode?.closest('a[href]')
      || (container.matches('a[href]') ? container : null)
      || container.querySelector('a[href]')
    return {
      tier,
      title: text(titleNode) || text(anchor),
      href: anchor?.href || '',
      snippet: text(first(container, spec.snippet)),
    }
  }
  const primary = spec.container?.length ? [...document.querySelectorAll(spec.container.join(','))] : []
  const headings = [...document.querySelectorAll('a[href] h3')].map(heading => heading.closest('a[href]'))
  const anchors = [...document.querySelectorAll('a[href]')].filter(anchor => text(anchor).length >= 4)
  const body = document.body
  return {
    candidates: [
      ...primary.slice(0, maxPerTier).map(describe('primary')),
      ...headings.slice(0, maxPerTier).map(describe('heading')),
      ...anchors.slice(0, maxPerTier).map(describe('anchor')),
    ],
    url: location.href,
    title: document.title || '',
    sample: String(body?.innerText ?? body?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 500),
  }
}

/** The expression executed in the page for `engine`. */
export function serpExpression(engine) {
  return `(${collectSerpCandidates.toString()})(${JSON.stringify(engine.serp)}, ${MAX_CANDIDATES_PER_TIER})`
}

function parseHttpUrl(value, base) {
  try {
    const url = new URL(value, base)
    return /^https?:$/.test(url.protocol) ? url : null
  } catch { return null }
}

/** The result's real destination, or null when it is not a usable result. */
export function resultUrl(href, engine, pageUrl) {
  const link = parseHttpUrl(href, pageUrl)
  if (!link) return null
  const target = parseHttpUrl(engine.unwrap(link) ?? link.href)
  if (!target) return null
  const pageHost = parseHttpUrl(pageUrl)?.hostname
  if (target.hostname === pageHost || engine.ownsHost(target.hostname)) return null
  return target.href
}

export function isChallengePage(page, engine) {
  const haystack = `${page?.url || ''} ${page?.title || ''} ${page?.sample || ''}`
  return GENERIC_CHALLENGE.test(haystack) || !!engine.challenge?.test(haystack)
}

/**
 * Turns what `collectSerpCandidates` returned into results.
 *
 * `challenge` is only raised on an empty page: a result page that merely
 * mentions "captcha" in a snippet is still a result page.
 */
export function readSerp(page, engine, limit = MAX_RESULTS) {
  const candidates = Array.isArray(page?.candidates) ? page.candidates : []
  for (const tier of TIERS) {
    const results = []
    const seen = new Set()
    for (const candidate of candidates) {
      if (candidate?.tier !== tier) continue
      const title = String(candidate.title || '').trim()
      const url = resultUrl(candidate.href, engine, page.url)
      if (!title || !url || seen.has(url)) continue
      seen.add(url)
      results.push({ title, url, snippet: String(candidate.snippet || '').slice(0, SNIPPET_MAX_CHARS) })
      if (results.length >= limit) break
    }
    if (results.length) return { results, tier, challenge: false }
  }
  return { results: [], tier: null, challenge: isChallengePage(page, engine) }
}
