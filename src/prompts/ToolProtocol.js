export const STRUCTURED_TOOL_CALL_PROTOCOL = `NON-NEGOTIABLE STRUCTURED TOOL-CALL PROTOCOL:
The current request payload and its tools array are authoritative. A tool is a function, and the only valid way to invoke it is a structured tool_calls event with arguments matching the function schema in that payload. This protocol has priority over debate mode, role-play style, personality, constraints, and moderator wording.

When your reasoning requires a tool, emit the structured tool call as part of the assistant turn. Do not write the function name, arguments, JSON, Markdown code, or any pseudo-call in visible content. Writing the argument object on its own — under the sentence describing the action, or at the end of the message — is the same mistake: it invokes nothing and it is removed before anyone reads the turn. A tool instruction in a moderator message is not itself an invocation: the participant who must perform the action makes the structured call.

The tool result is then returned in the conversation as a tool message. Treat it as part of your reasoning context, use its actual result, and continue with a complete assistant response after the tool result. Never pretend that a tool ran, never replace its result with an invented value, and never stop at the tool call when a visible answer is still required.

If the required tool is not available in the payload or the structured tool interface cannot be used, do not simulate or describe a call. State the limitation plainly instead.`

/**
 * Sent instead of the protocol above when the request carries no tools array,
 * either because the model has no tool support or because every tool is off.
 * Silence is not enough here: a model that reads about tools it cannot call
 * writes the call as prose — an XML block, a JSON envelope, a function name —
 * and then argues from a result that was never produced.
 */
export const NO_TOOL_CALL_PROTOCOL = `NO TOOLS ARE AVAILABLE IN THIS TURN:
This request carries no tools array. There is no function you can call, nothing will be executed on your behalf, and no tool result will ever come back to you.

Therefore: never write a tool call in any form. No XML call markup of any dialect (tool_calls, function_calls, invoke, parameter blocks and the like), no JSON call envelope, no bare argument object, no function name with arguments, no announcement that you are about to search, fetch, open, or read anything. Such text is not an invocation — it is just text, and it will be discarded before anyone reads your turn.

Argue from what is already in this conversation. When something would require material you do not have, say plainly that you have not seen it and reason without it. Never describe the content of a page, document, or source that is not already quoted in this conversation, and never present an assumption about it as an observation.`

export function buildAvailableToolProtocol(tools = []) {
  const rules = (tools || []).flatMap(tool => {
    const name = tool?.function?.name
    const parameters = tool?.function?.parameters || {}
    const properties = Object.keys(parameters.properties || {})
    const required = Array.isArray(parameters.required) ? parameters.required : []
    const signature = `Native function: ${name}; argument object fields: ${properties.length > 0 ? properties.join(', ') : 'none'}${required.length > 0 ? `; required: ${required.join(', ')}` : ''}.`
    return (tool?.constraints || [])
      .map(constraint => String(constraint || '').trim())
      .filter(Boolean)
      .map(constraint => `- ${signature} ${constraint}`)
  })
  if (rules.length === 0) return ''
  return `MANDATORY RULES FOR THE TOOLS IN THIS REQUEST:\n${rules.join('\n')}\n\nWhen a rule requires a tool, select the native function by the exact name shown above and send its arguments as the structured object defined in the current tools array. This is an assistant API event, not visible content: never print the function name, argument object, XML, Markdown, or any textual imitation of the call. If you cannot emit the native function event, do not simulate it; write the contribution without that action and state the limitation plainly.`
}
