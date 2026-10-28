# src/debate/Debate.js

**Role** — The debate engine: the largest module of the project (about 110 kB). It runs the turns, decides who speaks next, builds each participant's prompt, calls the provider, streams the answer and appends the resulting messages to the session.

**Responsibilities**

- Turn order: sequential or random (`buildOrderedItems`), with the moderator able to reorder, cool down or intervene; facilitation intervals and permissiveness come from `settings/Settings`.
- Participant preparation: name, palette colour, character type, mood and intensity, education, age group, output language, response length, constraints and dynamic affinity are all resolved into prompts.
- Prompt assembly through `debate/PromptBuilder.js`, payload formatting through `debate/ContextPayload.js`, transport through `debate/Stream.js` and `providers/`.
- Memory, conclusions, summaries and interjections are threaded through the same loop, so a turn can start from a compacted context rather than the whole history.
- Emits the message kinds the timeline knows: participant turns, joins and leaves, dice rolls, topic, interjection, error.

**Notes**

- Deliberately framework-free: no React import. `DebateController` owns state and lifetime.
- Option tables are imported from `prompts/` and `dataset/` as raw values; localization happens in `App`.
- The engine's behaviour is model-dependent by design: it provides capabilities (tools, memory, moderation) and does not force a fixed chain of steps.
