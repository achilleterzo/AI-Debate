// @vitest-environment happy-dom
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { AUTO_ENGINE_ORDER, SEARCH_ENGINES, SEARCH_ENGINE_IDS } from '../electron/web/engines/catalog.js'
import { ENGINES, engineById } from '../electron/web/engines/index.js'
import { collectSerpCandidates, readSerp, resultUrl } from '../electron/web/serp.js'

// happy-dom replaces the global URL, so resolve fixture paths without it.
const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'serp')

/**
 * The fixtures are hand-written after each engine's markup. When an engine
 * changes, refresh them from the real page: run the desktop app with
 * AI_DEBATE_SERP_DUMP=<dir> and copy the dumped HTML here.
 */
function loadSerp(fixture, spec, pageUrl) {
  const html = readFileSync(path.join(FIXTURES, `${fixture}.html`), 'utf8')
  window.happyDOM.setURL(pageUrl)
  document.open()
  document.write(html)
  document.close()
  // The collector runs from its serialized source in production.
  const collect = new Function(`return (${collectSerpCandidates.toString()})`)()
  return collect(spec, 200)
}

function read(fixture, engineId, pageUrl) {
  const engine = engineById(engineId)
  return readSerp(loadSerp(fixture, engine.serp, pageUrl), engine)
}

describe('engine catalog', () => {
  it('has a descriptor for every catalogued engine', () => {
    for (const { id } of SEARCH_ENGINES) {
      expect(ENGINES[id].url('roma & co')).toMatch(/^https:\/\/.+roma%20%26%20co/)
      expect(ENGINES[id].serp.container.length).toBeGreaterThan(0)
    }
  })

  it('keeps the settings list and the Auto chain derived from one place', () => {
    expect(SEARCH_ENGINE_IDS).toEqual(['auto', 'duckduckgo', 'brave', 'bing', 'qwant', 'yandex', 'google'])
    expect(AUTO_ENGINE_ORDER).toEqual(['brave', 'bing', 'duckduckgo'])
  })
})

describe('reading result pages', () => {
  it('decodes Bing click-through links instead of discarding them as Bing-owned', () => {
    const { results, tier } = read('bing', 'bing', 'https://www.bing.com/search?q=roma+antica')
    expect(tier).toBe('primary')
    expect(results.map(result => result.url)).toEqual([
      'https://it.wikipedia.org/wiki/Roma_antica',
      'https://www.treccani.it/enciclopedia/roma',
      'https://www.britannica.com/place/ancient-Rome',
    ])
    expect(results[0].snippet).toContain('civiltà romana')
  })

  it('unwraps DuckDuckGo redirects and drops its ads', () => {
    const { results } = read('duckduckgo', 'duckduckgo', 'https://html.duckduckgo.com/html/?q=roma+antica')
    expect(results.map(result => result.url)).toEqual([
      'https://it.wikipedia.org/wiki/Roma_antica',
      'https://www.treccani.it/enciclopedia/roma',
    ])
    expect(results[0].title).toBe('Roma antica - Wikipedia')
  })

  it('does not pad real Brave results with navigation and footer links', () => {
    const { results } = read('brave', 'brave', 'https://search.brave.com/search?q=roma+antica')
    expect(results.map(result => result.url)).toEqual([
      'https://it.wikipedia.org/wiki/Roma_antica',
      'https://www.treccani.it/enciclopedia/roma',
    ])
  })

  it('unwraps Google /url links, keeps YouTube and drops Google-owned pages', () => {
    const { results } = read('google', 'google', 'https://www.google.com/search?q=roma+antica')
    expect(results.map(result => result.url)).toEqual([
      'https://it.wikipedia.org/wiki/Roma_antica',
      'https://www.youtube.com/watch?v=abc',
    ])
  })

  it('falls back to linked headings when the result containers were renamed', () => {
    const { results, tier } = read('rotated', 'google', 'https://www.google.com/search?q=roma+antica')
    expect(tier).toBe('heading')
    expect(results.map(result => result.url)).toEqual([
      'https://it.wikipedia.org/wiki/Roma_antica',
      'https://www.treccani.it/enciclopedia/roma',
    ])
  })

  it('reads Qwant result cards and skips its ads', () => {
    const { results } = read('qwant', 'qwant', 'https://www.qwant.com/?q=roma+antica&t=web')
    expect(results.map(result => result.url)).toEqual([
      'https://it.wikipedia.org/wiki/Roma_antica',
      'https://www.treccani.it/enciclopedia/roma',
    ])
    expect(results[0].title).toBe('Roma antica - Wikipedia')
    expect(results[0].snippet).toContain('civiltà romana')
  })

  it('reports Qwant unavailability instead of returning its footer links', () => {
    const outcome = read('qwant-unavailable', 'qwant', 'https://www.qwant.com/?q=roma+antica&t=web')
    expect(outcome.results).toEqual([])
    expect(outcome.challenge).toBe(true)
  })

  it('reads Yandex cards, unwraps its redirects and drops Yandex-owned links', () => {
    const { results } = read('yandex', 'yandex', 'https://yandex.com/search/?text=roma+antica')
    expect(results.map(result => result.url)).toEqual([
      'https://it.wikipedia.org/wiki/Roma_antica',
      'https://www.treccani.it/enciclopedia/roma',
    ])
    expect(results[1].snippet).toBe('Voce enciclopedica sulla città di Roma.')
  })

  it('does not treat footer links on a challenge page as results', () => {
    const outcome = read('challenge', 'bing', 'https://www.bing.com/search?q=roma')
    expect(outcome.results).toEqual([])
    expect(outcome.challenge).toBe(true)
  })

  it('reports a challenge page instead of an empty result set', () => {
    const outcome = read('challenge', 'google', 'https://www.google.com/sorry/index?continue=x')
    expect(outcome.results).toEqual([])
    expect(outcome.challenge).toBe(true)
  })
})

describe('resultUrl', () => {
  it('only unwraps redirects that belong to the engine', () => {
    const bing = engineById('bing')
    const legit = 'https://tools.example.org/redirect?q=https://other.example.org/'
    expect(resultUrl(legit, bing, 'https://www.bing.com/search?q=x')).toBe(legit)
  })

  it('rejects non-http links', () => {
    expect(resultUrl('javascript:alert(1)', engineById('brave'), 'https://search.brave.com/search?q=x')).toBeNull()
  })
})
