# src/components/AttachmentsChips.jsx

**Role** — The chips for the documents and images attached to a session.

**Notes**

- Renders nothing at all when the list is empty (`if (attachments.length === 0) return null`), so it can be mounted unconditionally above the composer.
- An image attachment shows a small thumbnail of the image itself (`data:${mime};base64,…`, 16×16, cropped) while a document gets a file glyph; that difference is what lets a user tell at a glance whether the model can *see* it or must *read* it.
- `attachment.name` is the key, which matches `hooks/useAttachments.js` replacing an entry with the same name rather than appending a duplicate.
- Removal uses `RemoveButton`; the list is `flexWrap` so many attachments do not distort the composer.
