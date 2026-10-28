# src/tools/ConversationTools.js

**Role** — The tools that act on the conversation itself: `get_recent_messages`, `request_moderator_intervention`, `apply_moderation`, plus `formatRecentMessages` and the dispatcher that runs every tool call.

**Notes**

- `get_recent_messages` — the last N messages (1–50), optionally filtered by participant tag and by a case-insensitive search term. It exists because the payload only carries a window of the debate.
- What a participant *deliberated* is not what it *said*: the filter maps each message through `visibleContribution`, so leaked reasoning is neither returned nor searchable. This tool answers with contributions.
- Every returned message carries its `seq` as `id`, so a result pulled from outside the visible window can still be cited with `quote_message`.
- `request_moderator_intervention` (participants ask for an extra turn) and `apply_moderation` (moderator only) are separate definitions on purpose: the registry offers the first to the table and the second only to the moderator, and `tools/index.js` has precomputed lists without the intervention tool for when a moderator is already in charge.
- `createConversationToolExecutor` is the single dispatcher: it takes the callbacks the engine provides (messages, moderation, dice, memory, quote, attachments, images) and returns text/JSON in every branch. An unavailable capability answers with `accepted: false` and a reason — it never returns nothing, because silence invites invention.
- `view_image` is the one tool whose result is a pair (`{ content, images }`), so `Stream.js` can place the picture next to the result.
- Exercises: `tests/ConversationTools.test.js`.
