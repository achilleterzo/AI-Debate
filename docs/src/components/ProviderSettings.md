# src/components/ProviderSettings.jsx

**Role** — The AI Providers dialog: one tab per provider, its key or address, its models, its default model and thinking level — plus the CLI login flow.

**Notes**

- Imports the Ollama tab (`OllamaSettings.jsx`) and builds the other tabs from configuration rather than with parallel copies: `KEY_PROVIDER_IDS` says which providers need an API key, `PROVIDER_OPTION_FIELDS` says which options each one has, and `providerThinkingLevelOptions` / `clampThinkingLevel` keep the thinking level valid for the chosen model. That is why five hosted providers fit in one dialog.
- API keys are *not* kept in app state beyond the session: they go to the main process through the bridge (`providers/hosted.js`). The dialog still works before a key is saved, which is what makes Connect-then-save possible.
- The CLI tab polls the client for a while to see whether a login completed (the timer near the top of the file); `CODEX_SANDBOXES` configures the Codex sandbox.
- Provider logos come from `assets/provider-logos/`, the same icons `EndpointModelGroup` draws per participant.
- Exercises: `tests/AIModels.test.js` covers the model list behaviour this dialog depends on.
