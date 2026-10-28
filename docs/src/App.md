# src/App.jsx

**Role** — The application shell and its single orchestrator. `App` only wraps `AppInner` in the `UiStringsProvider`; `AppInner` holds the session state (participants, messages, summary, topic, settings) and wires every hook and panel together.

**Exports** — default `App`.

**Depends on** — almost the whole tree: `data/Data`, `data/Session`, `data/Storage`, `services/AI`, `debate/Debate` and `debate/DebateController`, the `hooks/` layer, `components/` panels and modals, `prompts/` option tables, `i18n/`, `settings/Settings`.

**Notes**

- Also does the first job of the interface layer: takes the raw option tables from `prompts/` and `dataset/` and maps their labels through `UI_STRINGS`, so every downstream component receives already-localized options.
- Keeps the provider plumbing (`setActiveProviderId`, `configureOllamaCloud`) and the model list, keyed by provider, in one place.
- Contains `resetUnlockedAffinities`, the rule that keeps only the affinity values the user pinned when affinities are reset.

