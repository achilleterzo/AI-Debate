# src/components/DebateModeSettings.jsx

**Role** — The debate mode picker.

**Notes**

- What is left of the old connection panel: the endpoint and default model moved to the connection dialog, the session language rides along with the summary row, so the mode stayed here.
- Rendered as a row of chips rather than a select, because there are few modes and the choice applies to the whole table — the current one should be visible without opening anything.
- `debateModeOptions` comes pre-localized from `App`; the `modeLabels` fallback exists for an option whose label is missing.
- `disabled` is set while a debate runs: the mode is a property of the session, not something to change mid-turn.
