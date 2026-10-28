# src/components/PromptSettingsModal.jsx

**Role** — The big settings dialog, in four tabs: `main`, `ollama`, `promptRules`, `advanced`.

**Notes**

- `TABS = ['main', 'ollama', 'promptRules', 'advanced']` is the navigation; the Ollama tab is the imported `OllamaSettings`, and the provider work is delegated to `ProviderSettings`.
- Holds the settings that belong to the *prompt and the environment* rather than to a participant: the interface language (from `TRANSLATED_LANGUAGE_CODES`, i.e. only languages that actually exist as files), the enabled tools (`TOOL_SETTINGS`), the search engine (`SEARCH_ENGINE_IDS`, `AUTO_SEARCH_ENGINE`, `AUTO_ENGINE_ORDER`, `searchEngineAvailable` / `searchEngineInfo` from the Electron catalog), the page-block size (`PAGE_BLOCK_STEPS`), and the debug payload depth (`MIN_/MAX_DEBUG_PAYLOAD_TURNS`, `normalizeDebugPayloadTurns`).
- Shows the update state (`UPDATE_STATUS`, `UPDATE_ERROR`) with the manual re-check.
- Everything is edited on a local copy and committed with `onSave`; `onReset` and `onClear…` are the destructive paths, which is why they are separate from saving.
