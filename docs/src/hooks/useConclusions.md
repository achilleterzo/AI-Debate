# src/hooks/useConclusions.js

**Role** — Generating and keeping the conclusions of a session.

**Notes**

- The conclusion is a separate request, not a turn: it streams through `debate/Stream.js` with its own prompt built from the type chosen in `prompts/ConclusionTypes` (`conclusionTypeLabel`, `normalizeStandardConclusionPrompts`), the output language and the context budget (`contextBudgetChars`).
- Can be produced during a running debate as well as after it, and is stored per participant id so a re-generation replaces a participant's conclusion instead of piling up.
- The type list is data, so a new kind of conclusion is added in `prompts/ConclusionTypes.js` and appears here without changes.

**Where it is used** — `components/ConclusionsPanel.jsx`, wired in `App`.
