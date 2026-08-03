import { describe, expect, it } from 'vitest'
import {
  GET_RECENT_MESSAGES_TOOL,
  LLM_TOOLS,
  REQUEST_MODERATOR_INTERVENTION_TOOL,
  MEMORY_TOOL,
  createConversationToolExecutor,
  formatRecentMessages,
} from '../src/tools'
import { ROLL_DICE_TOOL, formatDiceRoll, rollDice } from '../src/tools/DiceTool'

const history = [
  { role: 'topic', turn: 0, content: 'The topic' },
  { role: 'A', turn: 1, content: 'First argument' },
  { role: 'participant_joined', turn: 1, content: '' },
  { role: 'B', turn: 1, content: 'Response' },
  { role: 'A', turn: 2, content: 'Follow-up' },
]

describe('conversation tools', () => {
  it('registers the web, history and moderator tools for the LLM', () => {
    expect(LLM_TOOLS.map(tool => tool.function.name)).toEqual([
      'web_search',
      GET_RECENT_MESSAGES_TOOL.function.name,
      REQUEST_MODERATOR_INTERVENTION_TOOL.function.name,
      MEMORY_TOOL.function.name,
    ])
  })

  it('returns the latest messages, optionally filtered by participant', () => {
    expect(JSON.parse(formatRecentMessages(history, { limit: 2 }))).toEqual({
      messages: [
        { role: 'B', turn: 1, content: 'Response' },
        { role: 'A', turn: 2, content: 'Follow-up' },
      ],
    })
    expect(JSON.parse(formatRecentMessages(history, { limit: 10, participantTags: ['A'] })).messages)
      .toEqual([
        { role: 'A', turn: 1, content: 'First argument' },
        { role: 'A', turn: 2, content: 'Follow-up' },
      ])
    expect(JSON.parse(formatRecentMessages(history, { limit: 10, searchTerm: 'RESPONSE' })).messages)
      .toEqual([{ role: 'B', turn: 1, content: 'Response' }])
  })

  it('schedules a moderator intervention through the executor', async () => {
    let request = null
    const execute = createConversationToolExecutor({
      getMessages: () => history,
      requestModeratorIntervention: args => { request = args; return { accepted: true } },
    })
    const result = await execute(REQUEST_MODERATOR_INTERVENTION_TOOL.function.name, { reason: 'Escalation', focus: 'Clarify the claim' })

    expect(JSON.parse(result)).toEqual({ accepted: true })
    expect(request).toMatchObject({ reason: 'Escalation', focus: 'Clarify the claim' })
  })

  it('rolls a bounded shared dice result through the tool executor', async () => {
    const result = rollDice({ count: 3, sides: 6 })
    expect(result.rolls).toHaveLength(3)
    expect(result.rolls.every(value => value >= 1 && value <= 6)).toBe(true)
    expect(result.total).toBe(result.rolls.reduce((sum, value) => sum + value, 0))
    expect(formatDiceRoll(result)).toContain('3d6')

    const execute = createConversationToolExecutor({ rollDice: args => ({ ...rollDice(args), shared: true }) })
    const toolResult = JSON.parse(await execute(ROLL_DICE_TOOL.function.name, { count: 2, sides: 8 }))
    expect(toolResult).toMatchObject({ count: 2, sides: 8, shared: true })
  })

  it('writes and filters collective memory by author', async () => {
    const memory = []
    const execute = createConversationToolExecutor({
      memory: async args => {
        if (args.action === 'write') {
          const entry = { authorTag: 'A', authorName: 'Alice', content: args.content }
          memory.push(entry)
          return { saved: true, entry }
        }
        return { entries: memory.filter(entry => !args.participantTags?.length || args.participantTags.includes(entry.authorTag)) }
      },
    })

    await execute(MEMORY_TOOL.function.name, { action: 'write', content: 'The gate opens only at dawn.' })
    const result = JSON.parse(await execute(MEMORY_TOOL.function.name, { action: 'read', participantTags: ['B'] }))
    expect(result.entries).toEqual([])
  })
})
