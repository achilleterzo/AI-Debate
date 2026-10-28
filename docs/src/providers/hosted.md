# src/providers/hosted.js

**Role** — The desktop bridge for the hosted providers (Ollama Cloud, OpenRouter, Gemini). It exists because of the API key.

**Notes**

- Keys are stored and used by the main process, which is also the only place that knows each provider's address. The renderer asks for a *path* and never holds a credential it could leak into a debug payload — or, in a browser build, into a page.
- `keyState` keeps, per provider, the key typed this session and whether one is saved; `hasHostedKey` treats either as present, which is what makes "Connect" work before anything is stored. `configureHostedKey` is the setter.
- `hostedRequest` — one request answered in full, rejecting with the provider's own message so a wrong key reads as a wrong key.
- `hostedErrorDetail` — the readable part of an error body: Ollama answers `{ error: "…" }`, the OpenAI-compatible APIs `{ error: { message } }`, Gemini sometimes wraps that in an array. All three are handled.
- `hostedStream` — turns the bridge's event protocol (`start`, `chunk`, `end`, `error`) into a `Response` with a `ReadableStream`, so callers read a hosted stream exactly as they read a direct `fetch`. The bytes stay the provider's own frames; the provider's parser reads them.
- Also exports `newRequestId` and `abortError`, used by every bridge consumer.
