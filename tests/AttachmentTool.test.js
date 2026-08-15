import { describe, expect, it } from 'vitest'
import { READ_ATTACHMENT_TOOL, readAttachment } from '../src/tools'
import { buildTopicPromptBlocks } from '../src/prompts/TopicPrompt'
import { Web } from '../src/services/Web'

const doc = (name, size) => ({ name, content: 'x'.repeat(size) })
const parse = (docs, args) => JSON.parse(readAttachment(docs, args))

describe('read_attachment', () => {
  it('lists what is attached when called without a name', () => {
    const result = parse([doc('brief.md', 40), doc('notes.txt', 10)], {})

    expect(result.attachments).toEqual([
      { name: 'brief.md', characters: 40 },
      { name: 'notes.txt', characters: 10 },
    ])
  })

  it('returns the document asked for', () => {
    const result = parse([doc('brief.md', 40)], { name: 'brief.md' })

    expect(result.name).toBe('brief.md')
    expect(result.content).toBe('x'.repeat(40))
    expect(result.blocks).toBe(1)
    expect(result.more).toBeUndefined()
  })

  it('serves a long document one block at a time, and says there is more', () => {
    Web.configure({ pageBlockKb: 8 })
    const size = Web.config.pageBlockChars
    const long = { name: 'report.md', content: `${'a'.repeat(size)}${'b'.repeat(500)}` }

    const first = parse([long], { name: 'report.md' })
    expect(first.blocks).toBe(2)
    expect(first.content).toBe('a'.repeat(size))
    expect(first.more).toContain('page 2')

    const second = parse([long], { name: 'report.md', page: 2 })
    expect(second.content).toBe('b'.repeat(500))
    expect(second.more).toBeUndefined()

    Web.configure({ pageBlockKb: 16 })
  })

  it('resolves a partial name rather than reporting a missing document', () => {
    // A model reads `annual-report.pdf` in the index and asks for `annual`.
    expect(parse([doc('annual-report.pdf', 20)], { name: 'annual' }).name).toBe('annual-report.pdf')
  })

  it('answers a wrong name with the index instead of nothing', () => {
    const result = parse([doc('brief.md', 20)], { name: 'missing.txt' })

    expect(result.error).toContain('missing.txt')
    expect(result.attachments).toEqual([{ name: 'brief.md', characters: 20 }])
  })

  it('says plainly that there is nothing attached', () => {
    expect(parse([], { name: 'brief.md' }).note).toContain('No documents')
    expect(parse([{ name: 'empty.txt', content: '   ' }], {}).attachments).toEqual([])
  })

  it('needs no argument, so an empty call is a valid listing', () => {
    expect(READ_ATTACHMENT_TOOL.function.parameters.required).toEqual([])
  })
})

describe('attachments in the system prompt', () => {
  const blocks = (docs, options) => buildTopicPromptBlocks({ history: [], attachedDocs: docs, ...options }).docsBlock

  it('inlines everything when the tool is not available', () => {
    // Without the tool the prompt is the only way the document can be read.
    const long = doc('report.md', 50_000)
    expect(blocks([long], { attachmentToolAvailable: false })).toContain(long.content)
  })

  it('still inlines a short document, tool or no tool', () => {
    // The round-trip would cost more context than the document itself.
    const short = doc('note.txt', 300)
    expect(blocks([short], { attachmentToolAvailable: true })).toContain(short.content)
  })

  it('indexes a long document instead of pasting it into every turn', () => {
    const long = doc('report.md', 50_000)
    const block = blocks([long], { attachmentToolAvailable: true })

    expect(block).not.toContain(long.content)
    expect(block).toContain('report.md')
    expect(block).toContain('50000 characters')
    expect(block).toContain('read_attachment')
  })

  it('shows the summary as a summary when one was made', () => {
    const summarized = { name: 'report.md', content: 's'.repeat(3_000) }
    const block = blocks([summarized], { attachmentToolAvailable: true, attachmentsSummarized: true })

    expect(block).toContain('Analytical summary')
    expect(block).toContain('the summary or opening shown is not the document')
  })

  it('says nothing at all when nothing is attached', () => {
    expect(blocks([], { attachmentToolAvailable: true })).toBe('')
  })
})
