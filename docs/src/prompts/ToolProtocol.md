# src/prompts/ToolProtocol.js

**Role** — The text that tells a model how it may call a tool. Three variants, chosen by the caller.

**Notes**

- `STRUCTURED_TOOL_CALL_PROTOCOL` — the main one: a tool is a function, and the only valid invocation is a structured `tool_calls` event whose arguments match the schema in the payload. It explicitly outranks debate mode, role-play style, personality, constraints and moderator wording, because a model that thinks style comes first writes the call as prose.
- It names the failure modes rather than hinting at them: writing the function name, the arguments, JSON, a Markdown code block or a pseudo-call in visible content; and writing the argument object on its own under the sentence describing the action. Both invoke nothing and are removed before anyone reads the turn.
- It also states a subtle point: a tool instruction inside a moderator message is not itself an invocation — the participant still has to emit the call.
- `buildAvailableToolProtocol` and `NO_TOOL_CALL_PROTOCOL` are the other two: describing the available tools, and telling the model plainly that it has no tools this turn (which is a different sentence from saying nothing).
- Deliberately contains no example of the forbidden syntax — printing one shows the model the shape to imitate. Same rule as the constraints block.
- Exercises: `tests/PromptBuilderPriorities.test.js`.
