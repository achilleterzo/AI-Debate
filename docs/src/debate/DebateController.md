# src/debate/DebateController.js

**Role** — The React hook `useDebateController`: the bridge between `App`'s state and the framework-independent `Debate` engine.

**Notes**

- Owns the control refs the engine reads while running: `stopRef` (stop requested), `turnRef` (current turn), `summaryRef` (running summary), `interjectRef` (user interjection), `roundLimitRef`, `seqRef` (message sequence).
- Receives the whole configuration as arguments (participants, models, thinking levels, summary options, affinity switches, tools, moderator settings) and passes it down; nothing is read from globals.
- Exposes the controls the UI needs — start, stop, and the setter bundle — and keeps `Debate` itself unaware of React.
- Splits the work with `debate/Debate.js`: this file knows about state and lifetime, `Debate.js` knows about turns, prompts and providers.
