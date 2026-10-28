# src/tools/MemoryTool.js

**Role** — `memory`: durable shared memory that survives the context window.

**Notes**

- A write belongs to the participant who invokes it; the stored entry can be read by everyone. The description says so, which is what stops a model from writing memory "on behalf of" someone else.
- `action: 'write' | 'read'`. For a read, `participantTags` filters by author (omit for all), `query` is a case-insensitive text filter, `limit` caps the result.
- Limits in one place: `MEMORY_MAX_ENTRIES = 200` for the store, `MEMORY_MAX_CONTENT_CHARS = 4000` per entry. `readMemory` clamps `limit` to 1–100 and returns the *newest* matching entries (`.slice(-max)`), so a truncated read still gets the recent context.
- `readMemory` returns `{ count, entries }` rather than formatted text, so the caller decides how to present it in the payload.
- Exercises: `tests/Debate.test.js` (memory across turns).
