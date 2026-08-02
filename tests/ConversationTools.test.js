import { describe, expect, it } from 'vitest'
import {
  GET_RECENT_MESSAGES_TOOL,
  LLM_TOOLS,
  REQUEST_MODERATOR_INTERVENTION_TOOL,
  createConversationToolExecutor,
  formatRecentMessages,
} from '../src/tools'

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
})
