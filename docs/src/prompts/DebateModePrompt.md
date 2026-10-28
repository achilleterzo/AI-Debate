# src/prompts/DebateModePrompt.js

**Role** — Turns the selected debate mode into prompt blocks.

**Notes**

- Templates sit at the top of the file so they can be reviewed and edited without reading through the selection logic at the bottom.
- `SHARED_MODE_BLOCK` declares the mode the highest-priority user-configured behavioural rule: it applies to every participant and every turn, outranks mood, personality, affinity, character style and ordinary constraints, while system/developer rules and binding moderator directives still take precedence. It also requires the participant to verify silently, before sending, that the answer *visibly performs* the rule — otherwise a model just mentions the mode and answers as if it were Free.
- Role Play gets an extra block that differs by role: the moderator is also the Master/Narrator (controls the world, adjudicates, rolls for whatever the scene needs), participants treat that narration as authoritative and roll only for their own action. A participant also gets the participation rule: do not debate or meta-comment on the narration, act inside the fiction.
- The comment records a real bug worth remembering: this used to look the mode's rule up in a per-mode constraints map that a mode never had, so every participant in every debate received the Free block and the selected mode never reached a turn — while still reaching the conclusions, which is exactly why it looked like the modes worked.
- Exercises: `tests/Modes.test.js`, `tests/PromptBuilderPriorities.test.js`.

