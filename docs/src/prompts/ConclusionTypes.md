# src/prompts/ConclusionTypes.js

**Role** — The kinds of conclusion a debate can produce, and the guidance text stored for each.

**Notes**

- Guidance is stored **per conclusion type**. One shared field meant a note written to strengthen a Summary was also sent with a Verdict and with the Blindspots, so the only safe thing to write in it was something generic — the opposite of what it is for. Each type now owns its text, and the `custom` type uses its own prompt field.
- `standardConclusionTypeIds()` — every type except `custom`.
- `normalizeStandardConclusionPrompts` reads guidance back from settings or a snapshot into that per-type map. A stored *string* is what every earlier version wrote and was applied to whichever type was generated: it is carried onto **every** type, so nothing a user wrote quietly stops being sent.
- `conclusionTypeLabel` is used by the panel, the chat and the export, so a conclusion is named the same everywhere.
- Exercises: `tests/ConclusionLabels.test.js`, `tests/ConclusionGuidance.test.js`, `tests/ConclusionContext.test.js`.

