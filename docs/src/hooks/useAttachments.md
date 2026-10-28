# src/hooks/useAttachments.js

**Role** — The attached documents of a session: the file input, the parsed list and its removal.

**Notes**

- Small by design: all the parsing work is in `data/Document.js`; this hook keeps the list and calls it.
- `addFiles` replaces an entry with the same name instead of appending a duplicate (`filter(entry => entry.name !== document.name)`), so re-attaching a corrected file does not leave two copies in the prompt.
- A file that fails to parse is skipped without breaking the batch.
