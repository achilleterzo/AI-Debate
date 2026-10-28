# src/providers/ollama.js

**Role** — The Ollama adapter: everything specific to the Ollama HTTP API — endpoint paths, request shape and the NDJSON stream format. The reference implementation the other providers are modelled on.

**Exports** — `ollamaProvider` only. The helpers below it (`parseLine`, `rememberCapabilities`, `guessSupportsTools`) stay private; `ollamaCloud.js` and `cli.js` build on the exported object.

**Notes**

- The division of labour is stated at the top of the file: orchestration — retries, the tool loop, timeouts, context compaction — deliberately stays in `Stream.js`, so adding a second provider costs one file instead of a refactor.
- There is no `sendChat` method. This provider is reached with a plain `fetch`; the `sendChat` slot exists for the providers that have to go through the desktop bridge (`hosted.js`, `cli.js`).
- Capabilities come from the endpoint, never from the model name. `/api/tags` carries a `capabilities` array per model, so listing the models for the picker already answers the question for free; `/api/show` covers anything asked about before a listing happened, with `CAPABILITIES_TIMEOUT_MS = 8000`.
- The cache is keyed by endpoint and model together (`capabilitiesByEndpoint`), because the same name can be a different build on another host. Values are lowercased before being stored.
- The name heuristic survives only as a last resort (`guessSupportsTools`): assume tools, minus the `deepseek` families known to have no tool slot in their chat template, with `v3` and later taken as tool-capable. Guessing used to be the main path and was wrong in both directions — it excluded `deepseek-v4` and `minimax-m2`, which do have tools, and admitted `phi3`, which does not. A wrong guess is not a missing feature: the prompt still described the tools, so the model typed the call as prose instead of emitting a tool\_calls event.
- The three capability questions answer differently when the endpoint cannot be asked, and each difference is deliberate:
  - `supportsTools` falls back to the guess, so a turn is not blocked over a lookup.
  - `supportsThinking` returns `true`: `think: true` against a model without the capability is an HTTP 400 and a lost turn, but there is no name heuristic worth having, so unknown keeps the current behaviour rather than silently disabling the feature.
  - `supportsVision` returns `false`: only a reported `vision` counts, because an image sent to a model without it is an error or, worse, silently dropped while the model describes a picture it never saw. Unknown is therefore no.
- `capabilities` never throws and never leaves the caller without an answer. `health` is `HEALTH_TIMEOUT_MS = 5000` against `/api/tags` and returns a boolean rather than an exception. `listModels` is the one method that does throw (`HTTP <status>`), and it fills the capability cache on the way out.
- `buildChatRequest` sends only what the user actually set: `num_ctx`, `num_predict` and `temperature` are mapped from the app's own option names into an `options` object that is omitted entirely when empty, so anything left blank stays the model's own default. `tools` and `think` are likewise omitted when null.
- `keep_alive` is passed through as a number when it looks like one and as a string otherwise: a debate returns to the same model every round, and unloading in between is what made each turn pay the load time again.
- `createStreamParser` buffers, because chunk boundaries do not respect line boundaries: an incomplete trailing line waits for the rest, and `flush()` drains what is left at stream end. `parseLine` emits `malformed`, `error`, `thinking`, `toolCalls`, `delta` and `done` — the same event vocabulary `openAiCompatible.js` reproduces, which is why `Stream.js` reads every provider the same way.
- Exercises: `tests/ProviderOllama.test.js` — registry fallback, the endpoint-over-name rule, one request per model, capabilities read off a listing, and the name fallback when the endpoint is down.

