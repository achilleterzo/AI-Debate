import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { AUTO_ENGINE_ORDER, AUTO_SEARCH_ENGINE } from './engines/catalog.js'
import { engineById } from './engines/index.js'
import { extractRenderedPage } from './extractPage.js'
import { readSerp, serpExpression } from './serp.js'
import { runInBrowser } from './browserSession.js'

export { disposeBrowser, showBrowser } from './browserSession.js'

const FETCH_TIMEOUT_MS = 30_000
const SEARCH_TIMEOUT_MS = 25_000

export async function browserFetchPage({ url, raw = false } = {}) {
  const expression = `(${extractRenderedPage.toString()})(${raw ? 'true' : 'false'})`
  const result = await runInBrowser(url, expression, { timeoutMs: FETCH_TIMEOUT_MS })
  return { text: String(result?.text || ''), title: String(result?.title || ''), url: String(result?.url || url || '') }
}

/**
 * Set AI_DEBATE_SERP_DUMP=<dir> to save every result page the browser reads:
 * that is how the test fixtures under tests/fixtures/serp are refreshed when
 * an engine changes its markup.
 */
async function dumpSerp(engineId, html) {
  const dir = process.env.AI_DEBATE_SERP_DUMP
  try {
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, `${engineId}-${Date.now()}.html`), String(html || ''), 'utf8')
  } catch (error) {
    console.warn('[webSearch] SERP dump failed:', error?.message || error)
  }
}

async function searchOne(query, engine) {
  const dumping = !!process.env.AI_DEBATE_SERP_DUMP
  const expression = dumping
    ? `Object.assign(${serpExpression(engine)}, { html: document.documentElement.outerHTML })`
    : serpExpression(engine)
  const page = await runInBrowser(engine.url(query), expression, { timeoutMs: SEARCH_TIMEOUT_MS })
  if (dumping) await dumpSerp(engine.id, page?.html)
  return page
}

export async function browserSearch({ query, engine = AUTO_SEARCH_ENGINE } = {}) {
  const text = String(query || '').trim()
  const candidates = engine === AUTO_SEARCH_ENGINE || !engineById(engine) ? AUTO_ENGINE_ORDER : [engine]
  if (!text) return { engine: candidates[0], results: [] }
  const failures = []
  for (const id of candidates) {
    const descriptor = engineById(id)
    try {
      const page = await searchOne(text, descriptor)
      const { results, challenge } = readSerp(page, descriptor)
      if (results.length) return { engine: id, results }
      if (challenge) throw new Error(`${id} presented a consent or anti-automation challenge`)
      failures.push(`${id}: no results${page?.title ? ` (${page.title})` : ''}${page?.sample ? ` — ${page.sample}` : ''}`)
    } catch (error) {
      failures.push(`${id}: ${error?.message || 'failed'}`)
    }
  }
  if (failures.every(failure => failure.includes(': no results'))) return { engine: candidates[candidates.length - 1], results: [], diagnostics: failures }
  throw new Error(failures.join('; '))
}
