# src/tools/QuoteTool.js

**Role** — Direct citation of another message in the debate: the `quote_message` tool and everything that makes a citation verifiable.

**Notes**

- Every message in a participant's payload is announced with its `[#id]` marker (see `ContextPayload.js`), and that id is the `seq` the timeline already assigns and persists. The tool turns one of those ids into a quotation attached to the turn being written: the chat renders a short clickable card that jumps to the original, and later payloads carry it so everyone knows which message was answered.
- `resolveQuotableMessage` refuses the roles that exist but cannot be quoted: `error`, `participant_joined`, `participant_left`, `pending`.
- `quotableText` runs the message through `visibleContribution`: leaked reasoning is not something its author said to the table, so it is not quotable material — a message that is nothing but deliberation has nothing to quote.
- The central rule: **a quotation nobody can check is worse than none.** If the model's `excerpt` does not appear literally in the message, the card falls back to the real opening and the tool result carries a warning telling the model not to attribute the invented wording. `verbatim` records which case it was.
- `abbreviateQuote` caps the card at `QUOTE_MAX_EXCERPT_CHARS = 240` and cuts on a word boundary when one is close (within 60% of the limit), so the card does not end mid-word for a few characters.
- A rejected request answers with `availableIds` (the last 12 quotable ids), which is what lets the model correct itself in the same turn.
- Exercises: `tests/QuoteTool.test.js`.
