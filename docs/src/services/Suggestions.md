# src/services/Suggestions.js

**Role** — The "magic wand": builds the prompts that ask a model for ready-to-use text and turns the answer back into a list of suggestions.

**Notes**

- Five modes in `SUGGESTION_MODE`: `STEER` (prompts the user could send to continue or steer the running debate), `CONCLUSION` (extra guidance for the conclusion, inferred from how the debate went), `PARTICIPANT` (a persona, driven by the selected character type), `GLOBAL_RULE` (a ground rule for the whole table) and `CONSTRAINT` (a behaviour rule for one participant).
- Two modes are per-row and carry an index in the mode string — `participantMode(index)` and `constraintMode(index)`, with `isParticipantMode` to test it — because each participant's wand is independent.
- Deliberately free of React and of the HTTP layer, so the prompt shape and the (very forgiving) parsing can be tested directly: `tests/Suggestions.test.js`.
- `MAX_CONSTRAINT_CHARS` is the length limit the constraint modal enforces.
- The HTTP call itself is done by the caller (`hooks/useMagicWand.js`); this module only formats and parses.
