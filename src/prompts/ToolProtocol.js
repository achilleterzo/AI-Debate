export const STRUCTURED_TOOL_CALL_PROTOCOL = `NON-NEGOTIABLE STRUCTURED TOOL-CALL PROTOCOL:
The current request payload and its tools array are authoritative. A tool is a function, and the only valid way to invoke it is a structured tool_calls event with arguments matching the function schema in that payload. This protocol has priority over debate mode, role-play style, personality, constraints, and moderator wording.

When your reasoning requires a tool, emit the structured tool call as part of the assistant turn. Do not write the function name, arguments, JSON, Markdown code, or any pseudo-call in visible content. A tool instruction in a moderator message is not itself an invocation: the participant who must perform the action makes the structured call.

The tool result is then returned in the conversation as a tool message. Treat it as part of your reasoning context, use its actual result, and continue with a complete assistant response after the tool result. Never pretend that a tool ran, never replace its result with an invented value, and never stop at the tool call when a visible answer is still required.

If the required tool is not available in the payload or the structured tool interface cannot be used, do not simulate or describe a call. State the limitation plainly instead.`
