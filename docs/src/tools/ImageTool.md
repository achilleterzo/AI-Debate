# src/tools/ImageTool.js

**Role** — `view_image`: looking at an image, for models that can.

**Notes**

- The tool result is text — tool messages carry no image on most backends — and the picture travels in the message right after it, which every vision model reads (`Stream.js` places it). The tool is offered only to a participant whose model reports the `vision` capability.
- `source` is either an attached image (matched like `read_attachment`: exact name, then substring) or an absolute http(s) URL — of an image *or of a web page*, which is then shown as a screenshot of how it renders.
- `defaultFetchImage` uses the desktop browser session when available (`desktop.webFetchImage`), which can also screenshot a page; the web build can only use a CORS-permitting `fetch`, and the error message says exactly that rather than failing silently.
- Images are normalized and thumbnailed through `services/Images` (`normalizeImage`, `makeThumbnail`, `imageCache`), so a repeated view costs one download.
- Constraint: describe an image only after viewing it, never from its file name, its URL or the text around it.
- Exercises: `tests/ImageTool.test.js` (the largest of the tool test suites).
