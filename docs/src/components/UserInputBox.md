# src/components/UserInputBox.jsx

**Role** — The box in which the user, as one of the participants, writes a turn.

**Notes**

- Takes the participant's own palette (`actor.bg`, `actor.border`, `actor.radiusOwn`), so a message written by the user in a participant's seat looks like that participant's balloon — the user is not a separate species of speaker.
- The side is decided by the participant's id parity (`id % 2 === 0`), the same convention the timeline uses for alignment, which keeps the user's turn in the column of the participant it belongs to.
- `onSkip` is offered next to `onSend`: a turn can be declined, and the debate continues rather than waiting.
- `userInputRef` is passed in from above because the composer needs to focus and clear it (`hooks/useTopicComposer.js`).
