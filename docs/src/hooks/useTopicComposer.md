# src/hooks/useTopicComposer.js

**Role** — The composer at the bottom of the screen: starting a debate, queueing an interjection, and the textarea behaviour that comes with it.

**Notes**

- One field does two jobs: before the debate starts it is the topic, during a running debate the same text becomes an interjection (`queueInterjection`, `interjectRef`). Forking into a new debate is handled here too (`forkedRef`).
- Shares the running engine's refs (`roundLimitRef`, `summaryRef`, `turnRef`) to decide whether a start or an interjection is possible right now.
- `autoGrowTextarea` (from `utils/Textarea.js`) keeps the box growing with the text without a re-render per keystroke.
- Remembers the topic text through `data/Storage` so a half-typed topic survives a reload.
