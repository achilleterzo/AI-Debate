import { describe, expect, it } from 'vitest'
import { extractPseudoToolCalls, stripPseudoToolCalls } from '../src/prompts/PseudoToolCalls'
import { LLM_TOOLS, MODERATOR_TOOLS, ROLL_DICE_TOOL } from '../src/tools'

const ALL_TOOLS = [...LLM_TOOLS, ...MODERATOR_TOOLS, ROLL_DICE_TOOL]

describe('arguments typed as prose', () => {
  // What a role-play turn actually produced: the action narrated in italics,
  // then the dice arguments alone under it, with no name and no markup.
  it('removes a bare argument object left under the narration', () => {
    const message = [
      '*Senza muovere un muscolo, attivo il mio Susanoo perfetto.*',
      '',
      '{ "count": 1, "sides": 20 }',
    ].join('\n')

    expect(stripPseudoToolCalls(message)).toBe('*Senza muovere un muscolo, attivo il mio Susanoo perfetto.*')
  })

  it('recognises the arguments of the other tools too', () => {
    expect(stripPseudoToolCalls('Verifico.\n\n{"query": "prezzo del rame 2026"}')).toBe('Verifico.')
    expect(stripPseudoToolCalls('Leggo la fonte.\n\n{"url": "https://example.com", "page": 2}')).toBe('Leggo la fonte.')
    expect(stripPseudoToolCalls('Cito.\n\n{"messageId": 12}')).toBe('Cito.')
  })

  it('keeps JSON that is being talked about rather than called', () => {
    const message = 'La risposta arriva come {"count": 1, "sides": 20} dentro la frase.'
    expect(stripPseudoToolCalls(message)).toBe(message)
  })

  // Nothing here is the argument list of any tool, so it is data the debate is
  // about and it stays.
  it('keeps a standalone JSON object that is not a call', () => {
    const message = 'Ecco i dati:\n\n{"nome": "Madara", "clan": "Uchiha"}'
    expect(stripPseudoToolCalls(message)).toBe(message)
  })

  // What the balloon shows mid-stream, and what a truncated reply ends on.
  it('removes an argument object the model never closed', () => {
    expect(stripPseudoToolCalls('Attacco.\n\n{ "count": 1, "sides"')).toBe('Attacco.')
    expect(stripPseudoToolCalls('Attacco.\n\n{ "count": 1,')).toBe('Attacco.')
  })

  it('keeps an unclosed brace that belongs to the prose', () => {
    const message = 'Il set è definito come {"nome": "Madara"'
    expect(stripPseudoToolCalls(message)).toBe(message)
  })

  it('empties the fence a typed call was wrapped in', () => {
    expect(stripPseudoToolCalls('Tiro.\n\n```json\n{"count": 2, "sides": 6}\n```')).toBe('Tiro.')
  })
})

describe('calls typed with a name', () => {
  it('removes the JSON call dialects, wherever they sit', () => {
    expect(stripPseudoToolCalls('Cerco: {"name": "web_search", "arguments": {"query": "rame"}} e poi rispondo.'))
      .toBe('Cerco:  e poi rispondo.')
    expect(stripPseudoToolCalls('[TOOL_CALLS] [{"name": "roll_dice", "arguments": {"count": 1, "sides": 20}}]')).toBe('')
    expect(stripPseudoToolCalls('<|python_tag|>{"name": "web_search", "parameters": {"query": "x"}}<|eom_id|>')).toBe('')
    expect(stripPseudoToolCalls('functools[{"name": "quote_message", "arguments": {"messageId": 3}}]')).toBe('')
  })

  // The name and its arguments with no markup at all — not JSON, not a tag.
  // The opening line of a real turn looked exactly like the first one.
  it('removes the call written with no markup at all', () => {
    expect(stripPseudoToolCalls('roll_dice{count:1,sides:20}\n\nGuts, parli di "peso".')).toBe('Guts, parli di "peso".')
    expect(stripPseudoToolCalls("Registro questo. memory {action: 'write', content: 'nota'}")).toBe('Registro questo.')
    expect(stripPseudoToolCalls('Attacco e `roll_dice(1d20)` decide.')).toBe('Attacco e  decide.')
    expect(stripPseudoToolCalls('Tiro roll_dice(count=2, sides=10) adesso.')).toBe('Tiro  adesso.')
  })

  // Straight from a role-play round: every participant, and the moderator,
  // typing the tool name as a tag with its arguments as attributes.
  it('removes the tool name used directly as a tag', () => {
    expect(stripPseudoToolCalls('**Attacco Madara Uchiha**: <roll_dice count="1" sides="20"/> Gli do un pugno normale.'))
      .toBe('**Attacco Madara Uchiha**:  Gli do un pugno normale.')
    expect(stripPseudoToolCalls('L\'attacco è stato patetico.\n\n<quote_message messageId="50" />\n\nUn fallimento totale.'))
      .toBe('L\'attacco è stato patetico.\n\nUn fallimento totale.')
    expect(stripPseudoToolCalls('<memory action="write" content="x">')).toBe('')
    expect(stripPseudoToolCalls('Testo </roll_dice> altro')).toBe('Testo  altro')
  })

  it('still removes the XML dialects it always did', () => {
    expect(stripPseudoToolCalls('<call:roll_dice count="1" sides="20"/>')).toBe('')
    expect(stripPseudoToolCalls('<function_calls><invoke name="web_search"></invoke></function_calls>')).toBe('')
    expect(stripPseudoToolCalls('Testo <tool_call>{"name": "memory"}</tool_call> altro')).toBe('Testo  altro')
  })

  // A model that types the call often types the answer it wanted too, and that
  // result is as invented as the call.
  it('removes an invented tool result', () => {
    expect(stripPseudoToolCalls('Ho tirato.\n<tool_response>{"total": 20}</tool_response>\nEsce 20.')).toBe('Ho tirato.\n\nEsce 20.')
  })
})

describe('turning a typed call into a real one', () => {
  it('recovers a named call for a tool this request offered', () => {
    const calls = extractPseudoToolCalls('[TOOL_CALLS] [{"name": "web_search", "arguments": {"query": "rame"}}]', LLM_TOOLS)
    expect(calls).toEqual([{ id: 'pseudo-1', type: 'function', function: { name: 'web_search', arguments: { query: 'rame' } } }])
  })

  it('recovers the roll the participant typed as a tag, so the dice really fall', () => {
    const calls = extractPseudoToolCalls('**Attacco Madara Uchiha**: <roll_dice count="1" sides="20"/> Un pugno.', [ROLL_DICE_TOOL])
    expect(calls).toEqual([{ id: 'pseudo-1', type: 'function', function: { name: 'roll_dice', arguments: { count: 1, sides: 20 } } }])
  })

  it('does not invoke a paired block twice', () => {
    const calls = extractPseudoToolCalls('<memory>{"action": "read"}</memory>', LLM_TOOLS)
    expect(calls).toEqual([{ id: 'pseudo-1', type: 'function', function: { name: 'memory', arguments: { action: 'read' } } }])
  })

  it('recovers a markup-free call whose arguments fit the schema', () => {
    expect(extractPseudoToolCalls('roll_dice{count:1,sides:20}\n\nGuts, parli di "peso".', [ROLL_DICE_TOOL]))
      .toEqual([{ id: 'pseudo-1', type: 'function', function: { name: 'roll_dice', arguments: { count: 1, sides: 20 } } }])
    expect(extractPseudoToolCalls("Registro. memory {action: 'write', content: 'nota'}", LLM_TOOLS))
      .toEqual([{ id: 'pseudo-1', type: 'function', function: { name: 'memory', arguments: { action: 'write', content: 'nota' } } }])
  })

  // `1d20` is a notation, not an argument object: the text is cleaned, but
  // nothing runs on arguments the model never actually wrote.
  it('runs nothing when the prose carries no usable arguments', () => {
    expect(extractPseudoToolCalls('Attacco e `roll_dice(1d20)` decide.', [ROLL_DICE_TOOL])).toEqual([])
    expect(extractPseudoToolCalls('Tiro roll_dice(count=2) adesso.', [ROLL_DICE_TOOL])).toEqual([])
  })

  it('recovers bare arguments when exactly one offered tool takes them', () => {
    const calls = extractPseudoToolCalls('Attacco.\n\n{ "count": 1, "sides": 20 }', [...LLM_TOOLS, ROLL_DICE_TOOL])
    expect(calls).toEqual([{ id: 'pseudo-1', type: 'function', function: { name: 'roll_dice', arguments: { count: 1, sides: 20 } } }])
  })

  it('runs nothing for a tool the request did not carry', () => {
    expect(extractPseudoToolCalls('Attacco.\n\n{ "count": 1, "sides": 20 }', LLM_TOOLS)).toEqual([])
    expect(extractPseudoToolCalls('[TOOL_CALLS] [{"name": "roll_dice", "arguments": {"count": 1, "sides": 20}}]', LLM_TOOLS)).toEqual([])
  })

  it('runs nothing for JSON quoted inside a sentence', () => {
    expect(extractPseudoToolCalls('Il tiro è { "count": 1, "sides": 20 } come detto.', [ROLL_DICE_TOOL])).toEqual([])
  })
})

// The shapes are written out in the module to avoid an import cycle, so this is
// what keeps them honest.
describe('the argument shapes match the real tool definitions', () => {
  it.each(ALL_TOOLS.map(tool => [tool.function.name, tool]))('%s', (name, tool) => {
    const args = Object.fromEntries((tool.function.parameters.required ?? []).map(key => [key, 1]))
    const message = `Testo.\n\n${JSON.stringify(args)}`

    expect(stripPseudoToolCalls(message)).toBe('Testo.')
    expect(extractPseudoToolCalls(message, [tool])).toEqual([
      { id: 'pseudo-1', type: 'function', function: { name, arguments: args } },
    ])
  })
})
