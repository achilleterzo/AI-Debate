# src/components/PayloadModal.jsx

**Role** — The debug inspector: shows a request payload or a stored value as formatted JSON.

**Notes**

- Accepts a string or an object (`typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2)`) so the same dialog serves the request body and the summary debug text.
- Read-only on purpose: this is for understanding what was sent, and an editable payload would invite changing a request from a viewer.
- Mounted from `AppModals` whenever `payloadModal` holds a value, and opened from `PromptEstimateBadge` and the summary panel's debug links.
- `title` is passed in, because the same component shows the last prompt, the last request and the summary debug.
