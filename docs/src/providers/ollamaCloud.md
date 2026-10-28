# src/providers/ollamaCloud.js

**Role** — Ollama's hosted service: the same API as `ollama.js`, but reached through the desktop bridge because the key lives in the main process.

**Exports** — `OLLAMA_CLOUD_URL = 'https://ollama.com'` and `ollamaCloudProvider`.

**Notes**

- Spreads `ollamaProvider` and overrides only what differs: `id`, `label`, `capabilities`, `supportsTools`, `supportsThinking`, `listModels`, `health`, `buildChatRequest`, `sendChat`. Everything else — `supportsVision` and `createStreamParser` in particular — is Ollama's implementation, unchanged.
- `capabilitiesByModel` is keyed by **model alone**, unlike `capabilitiesByEndpoint` in `ollama.js`: there is only one endpoint here, so the endpoint half of the key would be constant.
- `/api/show` is a POST through the bridge (`cloudRequest` → `hostedRequest('ollama-cloud', …)`), the response parsed by hand, and the capabilities lowercased. Values are cached only when the answer is an array: a `null` is returned but not cached, so a transient failure is retried on the next call instead of being remembered as "no capabilities".
- Both capability questions answer `true` when the endpoint cannot be asked. This differs from `ollama.js`, where tools fall back to a guess on the model name: here an unreachable bridge says nothing about the model, so the assumed answer stays yes.
- `listModels` maps `model.name || model.model` and filters falsy entries, because the listing and other responses do not always use the same field.
- `health` checks the key first (`hasHostedKey`), then a cheap `/api/tags`: a missing key is a `false` without a round trip.
- `buildChatRequest` delegates to Ollama's with `baseUrl: OLLAMA_CLOUD_URL` and then re-sets the JSON content type, so the request shape cannot drift between local and cloud.
- `sendChat` is the one method `ollama.js` does not have: `hostedStream('ollama-cloud', …)` with `path: '/api/chat'` and the already-built body, returning a `Response` that the Ollama stream parser reads unchanged.
- Exercises: `tests/ProviderOllamaCloud.test.js`.

