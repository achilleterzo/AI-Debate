# src/debate/ContextPayload.js

**Role** — Writes one transcript message into a participant's payload, and defines the two conventions the whole tool layer depends on.

**Notes**

- **Ids** — every message the actor did not write is announced by `[#seq]`, the number the timeline assigns and the snapshots keep. That gives `quote_message` a stable handle, and a cited id always resolves to something the reader can open. The actor's own turns stay bare on purpose: a model that sees a marker on its own words starts writing markers of its own.
- **Citations** — a quotation travels with its excerpt, not only the id: an id alone tells the other participants that something was cited without telling them what. This is what lets a quoting turn stay readable in the payload.
- Small module, but the reference point for anyone changing the transcript format: `formatHistoryMessage` is called by `debate/Debate.js`.
