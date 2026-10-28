# src/data/Storage.js

**Role** — The `localStorage` wrapper: one class with the keys and the typed load/save helpers for everything the app keeps between launches.

**Notes**

- `LS_KEY = 'pap_settings'` (application settings), `LEGACY_CHAT_KEY = 'pap_chat'` (written by older versions that kept the chat in progress; now only ever removed), plus the topics list (`pap_topics`), the global-constraints history and the endpoints history.
- The `pap_` prefix is historical and appears in every key; keep it when adding new ones.
- Normalization of the values it reads back lives in `settings/Settings.js` (e.g. `normalizeProviderModelCache`), so a corrupt or outdated entry cannot reach the UI unvalidated.
- Also the place where the dismissible notices and the splash preference are remembered.
