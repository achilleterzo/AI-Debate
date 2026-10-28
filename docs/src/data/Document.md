# src/data/Document.js

**Role** — Turns an attached file into plain text the models can read.

**Notes**

- `MAX_CHARS = 8000`: the cap per document, applied after normalization; the result carries a `truncated` flag so the UI can say so.
- Normalization: `\r\n` → `\n`, runs of three or more newlines collapsed to two, then trimmed — the same shape the prompts expect.
- `pdf` goes through `extractPdf`, everything else through `file.text()`; images take a different route entirely (`parseImage`, `services/Images`) and are not text-extracted.
