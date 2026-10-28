# src/prompts/TopicPrompt.js

**Role** — The topic and the attached documents as the participants receive them.

**Notes**

- `ATTACHMENT_INLINE_CHARS = 2000`: below this an attachment is simply included, because the round trip through the tool would cost more context than the document itself.
- `ATTACHMENT_PREVIEW_CHARS = 700`: how much of a long attachment the index shows, so a later `read_attachment` call is informed rather than blind.
- Why it is split at all: everything used to be pasted in whole, in every participant's prompt, on every turn. An 80 KB document was paid for once per turn per participant, and at the context budget it was the *transcript* that got cut to make room for it. With `read_attachment` available, long documents travel as an index — name, size, and enough of the opening to know what it is — and the full text is one tool call away.
- A short document, or any document when the tool is not available, is still included outright: the prompt never degrades to "there is an attachment you cannot see".
- `buildTopicPromptBlocks` emits the topic block and the attachment block separately.
- Exercises: `tests/ContextBudget.test.js`.
