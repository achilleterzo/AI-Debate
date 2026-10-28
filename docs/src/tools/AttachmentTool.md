# src/tools/AttachmentTool.js

**Role** — `read_attachment`: the documents attached to the debate, on demand.

**Notes**

- Why it exists: attachments used to travel one way only — every document pasted whole into every participant's system prompt, on every turn. A single long document was therefore paid for by each participant of each round, and once the summariser was on nobody could reach the source text at all, because the summary was all there was. This tool is the other direction: the prompt carries the index, and a participant that needs the actual wording asks for it.
- Called without `name` it lists the attachments; with `name` it returns that document, one block at a time, with `page` (1-based) and a `more` hint for the next block.
- `matchDocument` falls back to a substring match: a model that reads `report.pdf` in the index and asks for `report` is reaching for the right document, not a missing one.
- Block size is `max(2000, Web.config.pageBlockChars)` — the same setting `fetch_url` uses, so one knob bounds every large tool result the debate carries.
- Always answers with something readable: a missing attachment says so *and* lists what is there, or the model invents the contents it was asking for. An image attachment says it has no text and points to `view_image`.
