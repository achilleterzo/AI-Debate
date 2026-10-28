# src/settings/Settings.js

**Role** — The single place where constants and defaults live: endpoints, timings, limits, normalization of stored values.

**Notes**

- `DEFAULT_URL = 'http://localhost:11434'` (Ollama), `DEFAULT_PROVIDER_ID = 'ollama'`, `APP_VERSION`, the update repository and timeout.
- `TWO_COLUMN_MIN_WIDTH = 1200` decides when the settings column becomes an accordion. It must stay in sync with the `#root` media query in `src/index.css`, which caps the app width in single-column mode.
- Debate defaults: `DEFAULT_MAX_TURNS = 6`, `DEFAULT_USE_SUMMARY`, `DEFAULT_DYNAMIC_AFFINITY`, `DEFAULT_RANDOM_TURN_ORDER`, the summary options (`DEFAULT_SUMMARY_MODEL_ENABLED`, `…_OVERRIDE`, `…_ACCUMULATE`, `…_ACCUMULATE_THRESHOLD = 8`), `DEFAULT_SUMMARIZE_ATTACHMENTS`, `DEFAULT_TIMEOUT_SEC = 120`, `DEFAULT_FALLBACK_MODEL`.
- The disabled-models list is a *retrieval* filter, not a per-picker one: the names are dropped as the model list is fetched, so nothing downstream — pickers, default model, wizard — can offer them. That is why `normalizeDisabledModels` lives here and is applied in `services/AI.js`.
- Also holds the moderator defaults (`DEFAULT_MODERATOR_MODE`, `…_PERMISSIVENESS`, `…_FACILITATION_INTERVAL`, `contextBudgetChars`), the affinity cooling steps, the dismissible-notice keys, the splash key, the search-engine settings re-exported from the Electron catalog, and the normalizers that guard every value read back from storage.
- Rule of thumb for the codebase: a new constant goes here, not inline — `hooks/useAppSettings.js` and the tests both read this file.
