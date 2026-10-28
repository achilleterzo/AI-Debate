# src/components/OllamaSettings.jsx

**Role** — The Ollama tab of the settings dialog: which server the app talks to, and which of its models are allowed through.

**Notes**

- The models are a list of **switches**, not a picker, on purpose: this is where the catalogue is curated, not where a model is chosen for a turn. An endpoint commonly serves dozens of models, most irrelevant to a debate, and every one of them used to land in every select.
- Disabling is a retrieval filter rather than a UI filter (`AI.keepEnabledModels`, `normalizeDisabledModels`), so a switched-off model is not merely hidden — the app never learns it exists.
- Keeps the endpoint history with per-entry deletion (`onDeleteHistoryEntry`) and the default-model choice for the general provider.
- `ollamaOk` is a tri-state: `null` (not checked), `true`, `false`; the tab shows it rather than inventing a "unknown" that looks like a failure.
- `onSetAllModelsEnabled` is the bulk escape hatch when a large catalogue has been curated too aggressively.
