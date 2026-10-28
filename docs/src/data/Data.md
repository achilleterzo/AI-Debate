# src/data/Data.js

**Role** — Session persistence and export. The largest of the `data/` modules: it decides what a saved session contains, how it is written back, and how it is rendered as a standalone document.

**Responsibilities**

- Save and load sessions (topics list, settings, participants, messages) through `Storage`.
- Export a session as JSON, resolving internal state into human-readable labels.
- Export a session as HTML, reusing the chat's own stylesheet (`styles/ChatCss`) and the chat's own grouping helpers (`utils/ChatGrouping`) so the saved page looks like the live conversation.

**Notes**

- The HTML export deliberately imports `CHAT_CSS` and `renderMessageMarkdown` instead of re-implementing the look: a saved debate must show the same tool pills, follow-up balloons and citation anchors as the app.
- Because the JSON export resolves state into labels, reading it back is an undoing step — see `data/Session.js`, which owns that decoding (e.g. the `Verbosity: …` prefix).
- Image attachments are handled as thumbnails (`THUMBNAIL_EDGE`, `isThumbnailDataUrl` from `services/Images`) so an export does not carry full-size data URLs.
