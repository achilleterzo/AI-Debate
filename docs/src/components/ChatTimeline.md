# src/components/ChatTimeline.jsx

**Role** — The transcript: every balloon, tool pill, dice note, citation card, join/leave marker and conclusion, in order.

**Notes**

- Ordering comes from `utils/Sorting.js` (`buildOrderedItems`), and the *shape* of each turn comes from `utils/ChatGrouping.js` (`buildMessageGroup`, `alignmentFor`, `tailClassFor`, `resolveActor`, `roleEmojiFor`, `resolveDiceOwner`, `isLastContinuationBalloon`). The same helpers are used by the HTML export in `data/Data.js`, which is how the saved page stays identical to the live chat.
- Markdown goes through `renderMessageMarkdown`, whose caching is what keeps a long debate from re-parsing the whole transcript on every streamed chunk.
- Tool pills are drawn from `TOOL_ICONS` and described by `describeToolInvocation`; a `view_image` pill opens `ImageLightbox`, which re-resolves the full picture from the thumbnail.
- Citation cards jump with `scrollToMessage`, which uses `messageAnchorId` — the same id the export uses. Scrolling away from the bottom is intentional: it tells `useAppLayout` to stop following the stream, so the reader is not yanked back by the next token while reading the cited message.
- The click handler forces a reflow (`void target.offsetWidth`) before re-adding the highlight class, so clicking the same card twice restarts the animation instead of looking like a no-op.
- `memo` on the message rows matters: this re-renders on every chunk.
