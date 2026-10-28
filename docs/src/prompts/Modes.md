# src/prompts/Modes.js

**Role** — The debate modes: what the table is collectively trying to do.

**Notes**

- A mode is not a mood. A mode applies to the whole table; a mood remains an individual participant's behaviour. The file states that distinction at the top and it is worth keeping in mind when adding either.
- Each definition is one block with `id`, `emoji`, `instruction` and `conclusion`:
  - `instruction` is injected into every participant turn (see `prompts/DebateModePrompt.js`); `null` means "no specialised procedure", which is Free mode.
  - `conclusion` steers summaries, verdicts and the other closing outputs.
- Prompt text is written as separate clauses joined with a single space (`text(...parts)`), so a long instruction can be edited line by line without producing one unreadable string literal.
- **Order matters**: it is the order shown in the mode selector. The set includes Free, Brainstorm, Fact Check and others; `DEBATE_MODE_OPTIONS` is the localized-by-`App` view of the list, and `DEFAULT_DEBATE_MODE` / `normalizeDebateMode` guard stored values.
- Exercises: `tests/Modes.test.js`, `tests/ModeratorModes.test.js`.
