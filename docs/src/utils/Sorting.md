# src/utils/Sorting.js

**Role** — The single ordering rule for the timeline: messages and conclusions in one list, sorted by their sequence number.

**Notes**

- `messageSortKey` prefers `seq`, and falls back to `turn + 0.001` for a message saved before `seq` existed — the offset keeps such a message after its own turn's numbered entries instead of colliding with them.
- `conclusionSortKey` returns `Infinity` for a conclusion with no `seq`, so an old conclusion lands at the end rather than at the top.
- `buildOrderedItems` merges both kinds (`kind: 'msg'` / `kind: 'conclusion'`) and optionally keeps the original array indexes, which the caller needs to address a message or a conclusion by position.
- Shared by the chat (`ChatTimeline`), the export (`data/Data`) and the engine (`debate/Debate`), so the saved page and the live chat order things identically.
- Exercises: `tests/Sorting.test.js`, `tests/RoundOrder.test.js`.
