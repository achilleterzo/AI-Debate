# src/prompts/Moods.js

**Role** — The moods a participant can be given, each with the behavioural instruction it stands for.

**Notes**

- A mood is a per-participant behaviour, unlike a debate mode which applies to the whole table. Each entry is `{ id, emoji, constraints }`, and `constraints` is keyed by debate mode with a `default` — that map is what `resolveConstraint` in `ConstraintsPrompt.js` reads.
- `none` (emoji `-`) carries `default: null`: it means "no mood constraint", not "a neutral one".
- The set runs from cooperative, socratic, diplomatic through devil and antagonist to frivolous, flirt, liar and denialist — the unpleasant ones are deliberate, because a table that can only be polite cannot be used to test an argument.
- Ids only, no labels: `App` maps `id` through `UI_STRINGS.moods`. The emoji is the visible part everywhere else.
- Exercises: `tests/Moods.test.js`.
