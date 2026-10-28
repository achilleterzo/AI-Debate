# src/utils/ChatGrouping.js

**Role** — How a turn is assembled out of the raw message list. Shared by the chat and the HTML export.

**Notes**

- Why it exists: the chat and the export used to each decide on their own where a tool pill, a dice result or a follow-up balloon belonged, and the export drifted — tools were always dumped after the text and continuations came out as separate messages. Both now go through these helpers, so a saved debate shows the same sequence as the live chat.
- `NON_PARTICIPANT_ROLES` (`participant_joined`, `participant_left`, `dice`, `topic`, `interjection`, `error`) marks the message kinds that are not a participant turn; `isRenderableParticipantMessage` and `resolveActor` are the filters built on it.
- `MODERATOR_EMOJI = '⚖️'` and `roleEmojiFor` mark the moderator wherever the name is shown. The moderation badge only appears on a procedural intervention, so without this an ordinary moderator turn was indistinguishable from a participant's — the scales belong to the role, not to a single message.
- `messageAnchorId(seq)` gives the DOM id a citation card jumps to (`message-<seq>`), shared with the export so a quotation clicked in a saved page lands exactly where it lands in the app.
- `buildMessageGroup` assembles a balloon with its tool pills and continuations; `isLastContinuationBalloon`, `tailClassFor`, `alignmentFor`, `describeToolInvocation` and `resolveDiceOwner` cover the rest of the visual grammar.
