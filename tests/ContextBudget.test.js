import { describe, expect, it } from 'vitest'
import { CONVERSATION_SUMMARY_MARKER, compactMessages, isSummaryMessage, resolveBudget } from '../src/debate/Stream'
import { DEFAULT_SUMMARY_ACCUMULATE_THRESHOLD, contextBudgetChars } from '../src/settings/Settings'
import { Web } from '../src/services/Web'

const msg = (role, size) => ({ role, content: 'x'.repeat(size) })
const summary = (size = 100) => ({ role: 'user', content: `${CONVERSATION_SUMMARY_MARKER}\n${'s'.repeat(size)}` })
// What the debate actually sends: every context message is wrapped before it
// leaves, the pinned summary included.
const wrapped = message => ({ ...message, content: `<conversation_context>\n${message.content}\n</conversation_context>` })

describe('contextBudgetChars', () => {
  it('converts the KB setting the control shows into characters', () => {
    expect(contextBudgetChars(8)).toBe(8192)
    expect(contextBudgetChars(256)).toBe(262_144)
  })

  it('falls back to the default for anything unusable', () => {
    const fallback = DEFAULT_SUMMARY_ACCUMULATE_THRESHOLD * 1024
    expect(contextBudgetChars(0)).toBe(fallback)
    expect(contextBudgetChars(-4)).toBe(fallback)
    expect(contextBudgetChars('nonsense')).toBe(fallback)
    expect(contextBudgetChars()).toBe(fallback)
  })
})

describe('isSummaryMessage', () => {
  it('recognises the pinned summary through the wrapper the debate adds', () => {
    // The wrapper is why the old prefix check never matched a real turn.
    expect(isSummaryMessage(summary())).toBe(true)
    expect(isSummaryMessage(wrapped(summary()))).toBe(true)
  })

  it('does not take an ordinary message for one', () => {
    expect(isSummaryMessage(msg('user', 50))).toBe(false)
    expect(isSummaryMessage(wrapped(msg('user', 50)))).toBe(false)
    expect(isSummaryMessage({ role: 'user', content: `I read the ${CONVERSATION_SUMMARY_MARKER} above` })).toBe(false)
    expect(isSummaryMessage(null)).toBe(false)
  })
})

describe('resolveBudget', () => {
  it('keeps its own default when no context budget was configured', () => {
    expect(resolveBudget([msg('user', 10)], 0)).toEqual({ perMessage: 32_000, summary: 32_000 })
    expect(resolveBudget([msg('user', 10)])).toEqual({ perMessage: 32_000, summary: 32_000 })
    expect(resolveBudget([msg('user', 10)], Number.NaN)).toEqual({ perMessage: 32_000, summary: 32_000 })
  })

  it('gives a message the whole budget when nothing is pinned', () => {
    expect(resolveBudget([msg('user', 10)], contextBudgetChars(256)).perMessage).toBe(262_144)
  })

  it('spends the summary out of the budget first', () => {
    const pinned = summary(5_000)
    expect(resolveBudget([pinned, msg('user', 10)], 100_000).perMessage).toBe(100_000 - pinned.content.length)
  })

  it('counts the summary as it is actually sent, wrapper included', () => {
    const pinned = wrapped(summary(5_000))
    expect(resolveBudget([pinned], 100_000).perMessage).toBe(100_000 - pinned.content.length)
  })

  it('floors the per-message share so a large summary cannot starve every message', () => {
    // A summary is compacted at roughly the size of the setting, so the
    // subtraction alone can leave nothing at all.
    expect(resolveBudget([summary(20_000)], 8_192).perMessage).toBe(4_000)
    expect(resolveBudget([summary(500)], 2_048).perMessage).toBe(4_000)
  })

  it('gives the summary the whole budget, never the remainder it paid for', () => {
    // Charging it twice is what made the floor trim the pinned summary itself.
    expect(resolveBudget([summary(5_000)], 8_192).summary).toBe(8_192)
    expect(resolveBudget([summary(20_000)], 8_192).summary).toBe(8_192)
  })
})

describe('the transport guard sized on the setting', () => {
  // What streamChat does with the numbers, for a whole payload at one setting.
  const send = (messages, kb) => {
    const budget = resolveBudget(messages, contextBudgetChars(kb))
    return compactMessages(messages, { maxPerMsg: budget.perMessage, maxSummary: budget.summary })
  }

  it('no longer cuts a long message at the old fixed ceiling', () => {
    const long = msg('user', 60_000)
    expect(send([long], 256)[0].content).toBe(long.content)
  })

  it('still trims a message that alone exceeds what is left', () => {
    const [sent] = send([msg('user', 60_000)], 8)
    expect(sent.content.length).toBe(8_192)
    expect(sent.content).toContain('[truncated for context]')
  })

  it('does not trim the system prompt to the conversation budget', () => {
    // At a small setting this used to cut the persona and the tool protocol
    // out of the turn along with the transcript.
    const system = { role: 'system', content: 'S'.repeat(20_000) }
    const [sent] = send([system, msg('user', 10)], 2)
    expect(sent.content).toBe(system.content)
  })

  it('sends the pinned summary whole even when the floor is below its size', () => {
    // The regression this guards: the summary is charged once, by the
    // subtraction, and was then trimmed again to the remainder it had paid for.
    const pinned = wrapped(summary(6_000))
    const [sent] = send([pinned, msg('user', 500)], 8)
    expect(sent.content).toBe(pinned.content)
  })

  it('keeps a tool result at the size the page-block setting bought', () => {
    Web.configure({ pageBlockKb: 64 })
    const tool = { role: 'tool', content: 'T'.repeat(Web.maxToolResultChars()) }
    expect(send([tool], 2)[0].content).toBe(tool.content)
    Web.configure({ pageBlockKb: 16 })
  })

  it('pins the summary when the retry keeps only the last message', () => {
    const pinned = wrapped(summary(200))
    const kept = compactMessages([pinned, msg('user', 10), msg('assistant', 10)], { keepLast: 1, maxPerMsg: 6_000 })
    expect(kept).toHaveLength(2)
    expect(isSummaryMessage(kept[0])).toBe(true)
  })
})
