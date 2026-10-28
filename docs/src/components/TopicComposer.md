# src/components/TopicComposer.jsx

**Role** — The composer field at the bottom: the topic before a debate, the interjection during one, with the history dropdown and the wand.

**Notes**

- The field is **uncontrolled**: its text lives in `topicRef`, so React never writes it back on every keystroke (which would re-render the app and, in practice, the whole transcript). Restoring it on mount is what survives a remount, and that is why `useSnapshots` has to read the ref rather than a state value.
- The same field does two jobs: `handleStart` / `handleResume` before, `handleInterjection` during, and the button row reflects which is available.
- `topicHistory` with `removeHistoryEntry` is the recently-used topics list; `syncTopicFlag` and `flushTopic` keep the ref and the persisted value in step.
- The wand entry is passed in as `wand` and wired to `SUGGESTION_MODE.STEER` — this composer's suggestions are messages the user could send.
- `autoGrowTextarea` gives the field its growth without a state update per keystroke.
