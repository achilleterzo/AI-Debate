# src/providers/index.js

**Role** — The provider registry: one map from id to provider object, and the accessor everything else uses.

**Notes**

- `PROVIDERS` holds `ollama`, `ollama-cloud`, `openrouter`, `gemini`, `codex` and `claude`. Ollama is `DEFAULT_PROVIDER_ID`.
- `getProvider(id)` returns the requested provider, or the default when the id is unknown — an id left over in a saved session must never leave the app without a provider. `setActiveProviderId` applies the same guard.
- Nothing else in the codebase should import a concrete provider from this folder at call time: they go through `getProvider`, which is what lets a session mix local and hosted participants.
- Exercises: `tests/ProviderOllama.test.js` (registry resolution and fallback).
