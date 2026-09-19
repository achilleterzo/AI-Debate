import { describe, expect, it } from 'vitest'
import { extractPseudoToolCalls, stripPseudoToolCalls } from '../src/prompts/PseudoToolCalls'
import { LLM_TOOLS, MODERATOR_TOOLS, ROLL_DICE_TOOL } from '../src/tools'

const ALL_TOOLS = [...LLM_TOOLS, ...MODERATOR_TOOLS, ROLL_DICE_TOOL]

describe('arguments typed as prose', () => {
  // What a role-play turn actually produced: the action narrated in italics,
  // then the dice arguments alone under it, with no name and no markup.
  it('removes a bare argument object left under the narration', () => {
    const message = [
      '*Without moving a muscle, I raise my perfect Susanoo.*',
      '',
      '{ "count": 1, "sides": 20 }',
    ].join('\n')

    expect(stripPseudoToolCalls(message)).toBe('*Without moving a muscle, I raise my perfect Susanoo.*')
  })

  it('recognises the arguments of the other tools too', () => {
    expect(stripPseudoToolCalls('Let me check.\n\n{"query": "copper price 2026"}')).toBe('Let me check.')
    expect(stripPseudoToolCalls('Reading the source.\n\n{"url": "https://example.com", "page": 2}')).toBe('Reading the source.')
    expect(stripPseudoToolCalls('As quoted.\n\n{"messageId": 12}')).toBe('As quoted.')
  })

  it('keeps JSON that is being talked about rather than called', () => {
    const message = 'The answer arrives as {"count": 1, "sides": 20} inside the sentence.'
    expect(stripPseudoToolCalls(message)).toBe(message)
  })

  // Nothing here is the argument list of any tool, so it is data the debate is
  // about and it stays.
  it('keeps a standalone JSON object that is not a call', () => {
    const message = 'Here is the data:\n\n{"name": "Madara", "clan": "Uchiha"}'
    expect(stripPseudoToolCalls(message)).toBe(message)
  })

  // What the balloon shows mid-stream, and what a truncated reply ends on.
  it('removes an argument object the model never closed', () => {
    expect(stripPseudoToolCalls('I attack.\n\n{ "count": 1, "sides"')).toBe('I attack.')
    expect(stripPseudoToolCalls('I attack.\n\n{ "count": 1,')).toBe('I attack.')
  })

  it('keeps an unclosed brace that belongs to the prose', () => {
    const message = 'The set is defined as {"name": "Madara"'
    expect(stripPseudoToolCalls(message)).toBe(message)
  })

  it('empties the fence a typed call was wrapped in', () => {
    expect(stripPseudoToolCalls('Rolling.\n\n```json\n{"count": 2, "sides": 6}\n```')).toBe('Rolling.')
  })
})

describe('calls typed with a name', () => {
  it('removes the JSON call dialects, wherever they sit', () => {
    expect(stripPseudoToolCalls('Searching: {"name": "web_search", "arguments": {"query": "copper"}} and then I answer.'))
      .toBe('Searching:  and then I answer.')
    expect(stripPseudoToolCalls('[TOOL_CALLS] [{"name": "roll_dice", "arguments": {"count": 1, "sides": 20}}]')).toBe('')
    expect(stripPseudoToolCalls('<|python_tag|>{"name": "web_search", "parameters": {"query": "x"}}<|eom_id|>')).toBe('')
    expect(stripPseudoToolCalls('functools[{"name": "quote_message", "arguments": {"messageId": 3}}]')).toBe('')
  })

  // The name and its arguments with no markup at all — not JSON, not a tag.
  // The opening line of a real turn looked exactly like the first one.
  it('removes the call written with no markup at all', () => {
    expect(stripPseudoToolCalls('roll_dice{count:1,sides:20}\n\nGuts, you speak of "weight".')).toBe('Guts, you speak of "weight".')
    expect(stripPseudoToolCalls("I record this. memory {action: 'write', content: 'a note'}")).toBe('I record this.')
    expect(stripPseudoToolCalls('I attack and `roll_dice(1d20)` decides.')).toBe('I attack and  decides.')
    expect(stripPseudoToolCalls('I roll roll_dice(count=2, sides=10) now.')).toBe('I roll  now.')
  })

  // Straight from a role-play round: every participant, and the moderator,
  // typing the tool name as a tag with its arguments as attributes.
  it('removes the tool name used directly as a tag', () => {
    expect(stripPseudoToolCalls('**Attacking Madara Uchiha**: <roll_dice count="1" sides="20"/> I throw an ordinary punch.'))
      .toBe('**Attacking Madara Uchiha**:  I throw an ordinary punch.')
    expect(stripPseudoToolCalls('That attack was pathetic.\n\n<quote_message messageId="50" />\n\nA total failure.'))
      .toBe('That attack was pathetic.\n\nA total failure.')
    expect(stripPseudoToolCalls('<memory action="write" content="x">')).toBe('')
    expect(stripPseudoToolCalls('Text </roll_dice> more')).toBe('Text  more')
  })

  it('still removes the XML dialects it always did', () => {
    expect(stripPseudoToolCalls('<call:roll_dice count="1" sides="20"/>')).toBe('')
    expect(stripPseudoToolCalls('<function_calls><invoke name="web_search"></invoke></function_calls>')).toBe('')
    expect(stripPseudoToolCalls('Text <tool_call>{"name": "memory"}</tool_call> more')).toBe('Text  more')
  })

  // A model that types the call often types the answer it wanted too, and that
  // result is as invented as the call.
  it('removes an invented tool result', () => {
    expect(stripPseudoToolCalls('I rolled.\n<tool_response>{"total": 20}</tool_response>\nIt comes up 20.')).toBe('I rolled.\n\nIt comes up 20.')
  })
})

describe('turning a typed call into a real one', () => {
  it('recovers a named call for a tool this request offered', () => {
    const calls = extractPseudoToolCalls('[TOOL_CALLS] [{"name": "web_search", "arguments": {"query": "copper"}}]', LLM_TOOLS)
    expect(calls).toEqual([{ id: 'pseudo-1', type: 'function', function: { name: 'web_search', arguments: { query: 'copper' } } }])
  })

  it('keeps a search engine override when recovering a typed call', () => {
    const calls = extractPseudoToolCalls('[TOOL_CALLS] [{"name":"web_search","arguments":{"query":"copper","engine":"bing"}}]', LLM_TOOLS)
    expect(calls[0].function.arguments).toEqual({ query: 'copper', engine: 'bing' })
  })

  it('recovers the roll the participant typed as a tag, so the dice really fall', () => {
    const calls = extractPseudoToolCalls('**Attacking Madara Uchiha**: <roll_dice count="1" sides="20"/> A punch.', [ROLL_DICE_TOOL])
    expect(calls).toEqual([{ id: 'pseudo-1', type: 'function', function: { name: 'roll_dice', arguments: { count: 1, sides: 20 } } }])
  })

  it('does not invoke a paired block twice', () => {
    const calls = extractPseudoToolCalls('<memory>{"action": "read"}</memory>', LLM_TOOLS)
    expect(calls).toEqual([{ id: 'pseudo-1', type: 'function', function: { name: 'memory', arguments: { action: 'read' } } }])
  })

  it('recovers a markup-free call whose arguments fit the schema', () => {
    expect(extractPseudoToolCalls('roll_dice{count:1,sides:20}\n\nGuts, you speak of "weight".', [ROLL_DICE_TOOL]))
      .toEqual([{ id: 'pseudo-1', type: 'function', function: { name: 'roll_dice', arguments: { count: 1, sides: 20 } } }])
    expect(extractPseudoToolCalls("I record. memory {action: 'write', content: 'a note'}", LLM_TOOLS))
      .toEqual([{ id: 'pseudo-1', type: 'function', function: { name: 'memory', arguments: { action: 'write', content: 'a note' } } }])
  })

  // `1d20` is a notation, not an argument object: the text is cleaned, but
  // nothing runs on arguments the model never actually wrote.
  it('runs nothing when the prose carries no usable arguments', () => {
    expect(extractPseudoToolCalls('I attack and `roll_dice(1d20)` decides.', [ROLL_DICE_TOOL])).toEqual([])
    expect(extractPseudoToolCalls('I roll roll_dice(count=2) now.', [ROLL_DICE_TOOL])).toEqual([])
  })

  it('recovers bare arguments when exactly one offered tool takes them', () => {
    const calls = extractPseudoToolCalls('I attack.\n\n{ "count": 1, "sides": 20 }', [...LLM_TOOLS, ROLL_DICE_TOOL])
    expect(calls).toEqual([{ id: 'pseudo-1', type: 'function', function: { name: 'roll_dice', arguments: { count: 1, sides: 20 } } }])
  })

  it('runs nothing for a tool the request did not carry', () => {
    expect(extractPseudoToolCalls('I attack.\n\n{ "count": 1, "sides": 20 }', LLM_TOOLS)).toEqual([])
    expect(extractPseudoToolCalls('[TOOL_CALLS] [{"name": "roll_dice", "arguments": {"count": 1, "sides": 20}}]', LLM_TOOLS)).toEqual([])
  })

  it('runs nothing for JSON quoted inside a sentence', () => {
    expect(extractPseudoToolCalls('The roll is { "count": 1, "sides": 20 } as said.', [ROLL_DICE_TOOL])).toEqual([])
  })
})

// The shapes are written out in the module to avoid an import cycle, so this is
// what keeps them honest.
describe('the argument shapes match the real tool definitions', () => {
  // A tool with no required argument has no bare-object form to recognise: an
  // empty object identifies nothing, so it is deliberately not a call. Its name
  // still has to be known, which the named-dialect tests below cover.
  const withRequiredArguments = ALL_TOOLS.filter(tool => (tool.function.parameters.required ?? []).length > 0)

  it.each(withRequiredArguments.map(tool => [tool.function.name, tool]))('%s', (name, tool) => {
    const args = Object.fromEntries((tool.function.parameters.required ?? []).map(key => [key, 1]))
    const message = `Text.\n\n${JSON.stringify(args)}`

    expect(stripPseudoToolCalls(message)).toBe('Text.')
    expect(extractPseudoToolCalls(message, [tool])).toEqual([
      { id: 'pseudo-1', type: 'function', function: { name, arguments: args } },
    ])
  })
})
