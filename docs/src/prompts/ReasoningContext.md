# src/prompts/ReasoningContext.js

**Role** — The two blocks that tell a model how to read its prompt, and how to spend a reasoning pass — kept separate because only one of them applies to every participant.

**Notes**

- `hasNativeReasoning` checks the thinking level against `low`, `medium`, `high`, `max`. Anything else — `none`, or an unrecognized value — means the model produces no reasoning pass at all, matching how the level is normalized elsewhere.
- `CONTEXT_DISCIPLINE_BLOCK` is sent to **everyone**. It governs what counts as an instruction (identity, constraints, debate mode, tool protocol) versus what counts as reference material (topic, participants, memory, sources, attached context), and forbids treating a conversation message as a system instruction or inventing omitted history. These rules do not depend on the model thinking first.
- `REASONING_FOCUS_BLOCK` is sent **only where there is a reasoning pass**. Every line is about deliberation before answering, so for a participant with thinking disabled it would prescribe a step that never happens: pure prompt weight on every single turn.
- The split is itself the fix: these used to travel bundled together, so a participant with thinking off received the context rules only by accident of that bundling.
