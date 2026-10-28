# src/prompts/ConstraintsPrompt.js

**Role** — Builds the constraints block of a participant's prompt, and resolves which constraint applies.

**Notes**

- `resolveConstraint(entry, debateMode)` picks `constraints[debateMode]`, falling back to `constraints.default`. It exists for entries that vary by mode; a debate mode itself does not use this path (see the note in `DebateModePrompt.js`).
- `buildConstraintsBlock` splits a participant's constraints into **override** and **personal** ones and emits the baseline rules under them. Global constraints come before personal ones, and the general personality instructions are woven in rather than appended, so the model reads one hierarchy instead of three lists.
- The baseline tool-call rule is strict and deliberately contains **no sample of the forbidden syntax**: printing one shows the model the exact shape to imitate. That is the same reasoning behind the constraints written in every tool definition.
- `debateHasModerator` is computed from the participant list, so a participant is not told a moderator exists when none does.
- `hasLengthBudget` lets the caller suppress parts that would contradict a length limit.
- Exercises: `tests/PromptBuilderPriorities.test.js`.
