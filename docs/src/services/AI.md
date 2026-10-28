# src/services/AI.js

**Role** — Model discovery, independent of the provider: fetches the model list for an endpoint and filters it against the app's own settings.

**Notes**

- `AI.fetchModels(baseUrl, { providerId })` delegates to `getProvider(providerId).listModels(baseUrl)`, so the service never names a specific provider.
- `AI.keepEnabledModels` removes the models switched off in the Ollama tab. The filter lives here, not in a component, because everything that offers a model runs off the result: a disabled model is not merely hidden in one place, the app never learns it exists.
- Also exports the hook `useAIModels`, which wraps the fetch in React state (loading, error, cache by endpoint) for `App`.
