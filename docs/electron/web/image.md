# electron/web/image.js

**Role** — Downloads an image, or screenshots a web page, for the `view_image` tool.

**Notes**

- `MAX_IMAGE_BYTES = 15 MB` is enforced **while reading**, not only from `Content-Length`: `readCapped` checks the declared size first and then counts the bytes as they arrive, cancelling as soon as the limit is passed. A server that lies about its length, or sends no length at all, still cannot fill memory.
- Two timeouts, because the two jobs differ: `FETCH_TIMEOUT_MS = 20_000` for a download, `CAPTURE_TIMEOUT_MS = 30_000` for a screenshot, which has to load and render a page first.
- `assertAllowedUrl` (from `browserSession.js`) applies the same URL safety as a page fetch.
- A web page URL yields a screenshot of how it renders, which is what `ImageTool` promises the model; an image URL yields the image bytes.
- Exercises: `tests/ImageTool.test.js`.

