import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Web } from '../src/services/Web'
import { dropDuplicateNames } from '../src/hooks/useDebateWizard'

const FOOTER = 'About Us · Privacy Policy · Cookie Policy · Code of Ethics'

function page({ head = 'HEAD', filler = 'x', length = 40000, footer = FOOTER } = {}) {
  const middle = filler.repeat(Math.max(0, length - head.length - footer.length))
  return `${head}${middle}${footer}`
}

describe('clipPage', () => {
  it('leaves a page shorter than the limit untouched', () => {
    const result = Web.clipPage('short page', 100)
    expect(result).toEqual({ text: 'short page', truncated: false, fullLength: 10 })
  })

  it('keeps the footer, which is where a site declares who and what it is', () => {
    const result = Web.clipPage(page(), 24000, 6000)
    expect(result.truncated).toBe(true)
    expect(result.fullLength).toBe(40000)
    expect(result.text).toContain('HEAD')
    // The old head-only cut dropped exactly this, and the debate then reported
    // the pages as non-existent.
    expect(result.text).toContain('Privacy Policy')
    expect(result.text).toContain('Code of Ethics')
  })

  it('marks the elision instead of splicing the two halves silently', () => {
    const result = Web.clipPage(page(), 24000, 6000)
    expect(result.text).toMatch(/\[\.\.\. \d+ characters omitted from the middle of the page \.\.\.\]/)
  })

  it('never lets the tail eat more than half the budget', () => {
    const result = Web.clipPage(page({ length: 5000 }), 1000, 900)
    expect(result.text).toContain('HEAD')
    expect(result.text).toContain('Code of Ethics')
  })
})

describe('fetchAndSummarizePage', () => {
  const summarizePage = async () => 'A neutral summary of the page.'

  beforeEach(() => {
    Web.clearCaches()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    Web.clearCaches()
  })

  function stubFetch(impl) {
    vi.stubGlobal('fetch', vi.fn(impl))
  }

  it('says a page could not be read instead of staying silent about it', async () => {
    stubFetch(async () => { throw new Error('Failed to fetch') })
    const result = await Web.fetchAndSummarizePage('https://example.com/', { summarizePage })
    expect(result.status).toBe('error')
    expect(result.text).toContain('could not be retrieved')
    expect(result.text).toContain('Failed to fetch')
    expect(result.text).toMatch(/do not state that anything is missing/i)
  })

  it('reports an HTTP failure with its status', async () => {
    stubFetch(async () => ({ ok: false, status: 429, text: async () => '' }))
    const result = await Web.fetchAndSummarizePage('https://example.com/', { summarizePage })
    expect(result.status).toBe('error')
    expect(result.text).toContain('HTTP 429')
  })

  it('flags an empty page rather than passing an empty summary along', async () => {
    stubFetch(async () => ({ ok: true, status: 200, text: async () => '   ' }))
    const result = await Web.fetchAndSummarizePage('https://example.com/', { summarizePage })
    expect(result.status).toBe('empty')
    expect(result.text).toMatch(/no readable text/i)
  })

  it('warns the reader when only part of the page was read', async () => {
    stubFetch(async () => ({ ok: true, status: 200, text: async () => page() }))
    const result = await Web.fetchAndSummarizePage('https://example.com/', { summarizePage })
    expect(result.status).toBe('partial')
    expect(result.text).toContain('A neutral summary of the page.')
    expect(result.text).toContain('Partial reading')
    expect(result.text).toMatch(/never conclude that an element is missing/i)
  })

  it('adds no warning when the whole page fitted', async () => {
    stubFetch(async () => ({ ok: true, status: 200, text: async () => 'A complete little page.' }))
    const result = await Web.fetchAndSummarizePage('https://example.com/', { summarizePage })
    expect(result.status).toBe('ok')
    expect(result.text).toBe('A neutral summary of the page.')
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
