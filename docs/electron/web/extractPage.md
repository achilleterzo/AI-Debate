# electron/web/extractPage.js

**Role** — The page extractor. A function meant to be serialized with `toString()` and evaluated **inside** the page.

**Notes**

- Because it runs in the page, it can only use DOM APIs — no imports, no closures over module state. That constraint is the whole design of the file, and why it is a single exported function.
- Picks the content container first (`article, main, [role="main"]`, falling back to `body`), then clones it before mutating: the live DOM is never touched.
- Strips what is never content: `script`, `style`, `noscript`, `svg`, `canvas`, `picture`, `video`, `audio`, `iframe`, `form`, `input`, `button`, `select`, `textarea`, `nav`, `footer`, `aside`, `[aria-hidden="true"]`.
- Rewrites links as `[label](absolute-href)` — absolute because a relative href is useless to a model that will fetch it later. That is exactly what makes `fetch_url` iterative: a participant sees a link and calls the tool on it.
- Rebuilds headings, list items, blockquotes, `<pre>` and `<br>` as Markdown, then normalizes whitespace (trailing spaces per line, runs of blank lines).
- Prepends `# title` when the body does not already start with it.
- `raw: true` returns `body.innerText` untouched, for verbatim quotation.
