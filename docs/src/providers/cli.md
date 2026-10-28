# src/providers/cli.md

**Role** — Desktop clients (Codex, Claude Code) driven through the Electron bridge: `createCliProvider` builds a provider around a local CLI client.

**Notes**

- The clients take one prompt and stream one answer. They have no message list and no way to call a function living in this app. So the request is flattened here — the system prompt apart, the conversation as a transcript (`serializeTranscript`) — and the app's tools are offered as a *text* protocol (`toolProtocolInstructions`): the model writes a tool_call block, `Stream.js` recognises it as a typed call and runs it through the ordinary tool loop, and the next round carries the result in the transcript as a TOOL RESULT entry.
- The protocol text says explicitly that the model must not invent results, because a client with no tools will happily invent one.
- The bridge answers in the Ollama NDJSON shape, so `createStreamParser` is Ollama's parser unchanged.
- A finished tool_call block ends the request on the spot: the call is all the round needed, and anything written after it — often an invented result — is discarded anyway.
- `effortFor` translates `think`: false is none, a string is the level, true or null leave the client default.
- No vision: `supportsVision()` is false, because the prompt reaches the client as one flattened transcript with no image slot.
- Exercises: `tests/ProviderCli.test.js`, `tests/CliStream.test.js`, `tests/CliShim.test.js`.
