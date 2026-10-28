# src/providers/openAiCompatible.js

**Role** — The OpenAI chat dialect as a provider factory. OpenRouter and Gemini are built from it; everything the dialect owns lives here.

**Exports** — `toOpenAiMessages`, `openAiEffort` and `createOpenAiCompatibleProvider`. `imageDataUrl`, `toOpenAiTools` and `ssePayload` stay private.

**Notes**

- The header states the contract the file is built around: the events this parser emits are the ones the Ollama parser emits, so `Stream.js` — the tool loop, the retries, the thinking channel — reads every provider the same way. The request goes through the desktop bridge, so the API key stays in the main process.
- `toOpenAiMessages` translates the app's Ollama-shaped messages. The subtlety is tool calls: an incoming call has no id and its result is tied to it by name and position, so an id (`call_1`, …) is minted per call and carried into the following result through `pendingCallId`. Only the first call of a message becomes the pending one; a result with no call to belong to is handed over as plain text (`[Result of <tool>]`) rather than dropped.
- An assistant message carrying tool calls sends `content: message.content || null` — null, not an empty string.
- Images become `image_url` parts; `imageDataUrl` assumes JPEG when the base64 starts with `/9j/` and PNG otherwise, which is what the app's attachments and screenshots produce.
- `toOpenAiTools` strips the app's extra fields: only `type`, `name`, `description`, `parameters` go out, and a tool without parameters gets `{ type: 'object', properties: {} }`.
- `openAiEffort`: `null`, `false`, `true` and `'none'` all send no reasoning parameter at all — the model's own default — because an explicit "off" is not something every model behind these APIs accepts. `'max'` is clamped to `'high'`, the ceiling they offer. The field name comes from the factory's `reasoningField`: flat `reasoning_effort` (Gemini) or nested `reasoning: { effort }` (the default, OpenRouter).
- `buildChatRequest` sends `temperature` and `max_tokens` (from the app's `numPredict`) only when set, adds `tools` only when the stripped list is non-empty, and appends the factory's `usage` object — by default `{ usage: { include: true } }`, which Gemini overrides with a stream option instead.
- `sendChat` retries on `TRANSIENT_STATUSES` (408, 409, 429, 500, 502, 503, 504) with `RETRY_DELAYS_MS = [1500, 4000]`: twice, then it stops. The retry sits only before the first byte, because text already shown cannot be withdrawn. A status that is not transient is handed back as the response it is, so `Stream.js` reads the body and reports what the provider said — that is how a wrong key or an unknown model stays readable. The wait is abortable and rejects with `abortError()`.
- `createStreamParser` reassembles tool calls from fragments: name and JSON arguments arrive in pieces, so the call is emitted when the stream says the turn is over (`finish`, guarded so it runs once). Arguments that fail to parse become `{}` rather than losing the call.
- The fragment logic is subtler than "index 0 only". Gemini numbers parallel calls all at index 0, so the index does not say where one call ends: a fragment with a different `id`, or a new name after the arguments have started, closes the current call. Only the first call is kept — one per message, which is what the tool loop runs anyway — while a name split across fragments still joins up.
- Reasoning arrives in `delta.reasoning` or `delta.reasoning_content`; text in `delta.content`. An error inside a 200 answer (`chunk.error`, usually the model's own upstream provider failing mid-stream) is reported as an error event, reading `chunk.error.message || chunk.error` so a bare string also works.
- `flush()` finishes an unfinished turn: a stream that ended without a `finish_reason` still ended, and the turn is reported with whatever call it had collected.

