# src/components/SummarySettings.jsx

**Role** — The summary section of the settings: whether to summarize, when, with which model, and in which language.

**Notes**

- Also hosts the **output language** picker (`uiLang`), because the language of the summary and the language of the debate are the same decision. `OUTPUT_LANG_CUSTOM` opens the free-text modal instead of storing the sentinel; `isCustomOutputLanguage` decides which of the two controls is showing.
- `summaryAccumulateThreshold` is a stepped choice (`SUMMARY_ACCUMULATE_STEPS` from `settings/Settings.js`), not a free number — the thresholds are the ones the engine actually uses.
- `summaryModelEnabled` / `summaryModelOverride` pick a separate model for the summary through the same `EndpointModelGroup` a participant uses, so the summariser can be a cheaper model than the debaters.
- `summarizeAttachments` decides whether documents are summarized too, which is what keeps a long attachment from occupying the context for the whole run.
- `languageOptions` is built from `UI_LANGUAGE_OPTIONS` once, outside the component.
