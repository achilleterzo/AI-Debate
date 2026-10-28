# src/services/Web.js

**Role** — Web access: search, page fetching, extraction and caching, shared by the tools and the debate engine.

**Notes**

- Caches: `webSearchCache` and `pageCache`, per session, so a repeated lookup in a debate costs nothing.
- URL recognition is subtler than it looks. `URL_RE` has a lookbehind that keeps `blob:http://localhost/<uuid>` from yielding a phantom `http://localhost/<uuid>`, and trailing punctuation is trimmed separately, because a dot or comma is legal inside a path and illegal at its end — the older class fetched `https://example.com/page.` with the full stop attached and got a 404.
- Search goes through the engine catalog shared with the Electron side (`electron/web/engines/catalog.js`): `searchEngineAvailable` / `searchEngineLabel` decide what the UI offers, `normalizeSearchEngine` guards a stored value.
- Page size is capped by `DEFAULT_PAGE_BLOCK_KB`, and the desktop path is handled by `electron/web/` (real browser session) versus a plain fetch in the web build.
- `clearImageCache` (from `services/Images`) is called on reset, so downloaded images do not outlive the debate.
- Exercises: `tests/WebPage.test.js`, `tests/SerpReader.test.js`.
