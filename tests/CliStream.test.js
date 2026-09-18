import { describe, expect, it } from 'vitest'
import { claudeEffort, codexEffort, createClaudeTranslator, createCodexTranslator } from '../electron/cliStream.js'

const parse = lines => lines.map(line => JSON.parse(line))

describe('Claude stream-json translation', () => {
  it('forwards text and thinking deltas as they stream', () => {
    const translator = createClaudeTranslator()
    const out = [
      { type: 'system', subtype: 'init' },
      { type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: 'Hmm.' } } },
      { type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hel' } } },
      { type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'lo' } } },
      { type: 'assistant', message: { content: [{ type: 'text', text: 'Hello' }] } },
      { type: 'result', subtype: 'success', is_error: false, result: 'Hello', stop_reason: 'end_turn' },
    ].flatMap(event => parse(translator.push(event)))

    expect(out).toEqual([
      { message: { role: 'assistant', thinking: 'Hmm.' } },
      { message: { role: 'assistant', content: 'Hel' } },
      { message: { role: 'assistant', content: 'lo' } },
      { done: true, done_reason: 'end_turn' },
    ])
  })

  it('falls back to the final result when nothing was streamed', () => {
    const translator = createClaudeTranslator()
    const out = parse(translator.push({ type: 'result', subtype: 'success', is_error: false, result: 'Whole answer' }))
    expect(out).toEqual([
      { message: { role: 'assistant', content: 'Whole answer' } },
      { done: true, done_reason: null },
    ])
  })

  it('reports an error result instead of an empty answer', () => {
    const translator = createClaudeTranslator()
    const out = parse(translator.push({ type: 'result', subtype: 'success', is_error: true, result: 'Failed to authenticate: OAuth session expired' }))
    expect(out).toEqual([{ error: 'Failed to authenticate: OAuth session expired' }])
  })
})

describe('Codex app-server translation', () => {
  it('streams message deltas and ends on turn completion', () => {
    const translator = createCodexTranslator()
    const out = [
      { method: 'item/reasoning/summaryTextDelta', params: { itemId: 'r1', delta: 'Thinking' } },
      { method: 'item/agentMessage/delta', params: { itemId: 'm1', delta: 'For' } },
      { method: 'item/agentMessage/delta', params: { itemId: 'm1', delta: ' most' } },
      { method: 'item/completed', params: { item: { type: 'agentMessage', id: 'm1', text: 'For most' } } },
    ].flatMap(message => parse(translator.notification(message)))

    expect(out).toEqual([
      { message: { role: 'assistant', thinking: 'Thinking' } },
      { message: { role: 'assistant', content: 'For' } },
      { message: { role: 'assistant', content: ' most' } },
    ])
    expect(translator.finished).toBe(false)
    expect(parse(translator.notification({ method: 'turn/completed', params: { turn: { status: 'completed' } } }))).toEqual([{ done: true, done_reason: 'completed' }])
    expect(translator.finished).toBe(true)
  })

  it('separates two agent messages of the same turn', () => {
    const translator = createCodexTranslator()
    translator.notification({ method: 'item/agentMessage/delta', params: { itemId: 'a', delta: 'One.' } })
    const out = parse(translator.notification({ method: 'item/agentMessage/delta', params: { itemId: 'b', delta: 'Two.' } }))
    expect(out).toEqual([{ message: { role: 'assistant', content: '\n\nTwo.' } }])
  })

  it('uses a completed message that never streamed', () => {
    const translator = createCodexTranslator()
    const out = parse(translator.notification({ method: 'item/completed', params: { item: { type: 'agentMessage', id: 'x', text: 'Late' } } }))
    expect(out).toEqual([{ message: { role: 'assistant', content: 'Late' } }])
  })

  it('reports a failed turn, and ignores an error that will be retried', () => {
    const translator = createCodexTranslator()
    expect(translator.notification({ method: 'error', params: { willRetry: true, error: { message: 'retrying' } } })).toEqual([])
    expect(parse(translator.notification({ method: 'turn/completed', params: { turn: { status: 'failed', error: { message: 'usage limit' } } } }))).toEqual([{ error: 'usage limit' }])
  })
})

describe('reasoning levels per client', () => {
  it('maps the app levels onto Claude effort', () => {
    expect(claudeEffort('none')).toBe('low')
    expect(claudeEffort('max')).toBe('max')
    expect(claudeEffort(null)).toBeNull()
  })

  it('moves a Codex level to the nearest one the model supports', () => {
    expect(codexEffort('max', ['low', 'medium', 'high', 'xhigh'])).toBe('xhigh')
    expect(codexEffort('max', ['low', 'medium', 'high'])).toBe('high')
    expect(codexEffort('none', ['minimal', 'low', 'medium', 'high'])).toBe('minimal')
    expect(codexEffort('none', ['none', 'low'])).toBe('none')
    expect(codexEffort('medium')).toBe('medium')
    expect(codexEffort(null, ['low'])).toBeNull()
  })
})
