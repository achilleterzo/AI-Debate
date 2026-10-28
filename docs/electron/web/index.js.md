# electron/web/index.js

**Role** — The web layer of the desktop app: fetching pages, searching, and downloading images through a real Electron browser session.

**Notes**

- `browserFetchPage` runs `extractRenderedPage` **inside the page** (it is stringified and evaluated there) via `runInBrowser`, so what comes back is the rendered DOM, not the raw HTML — the difference between a usable page and an empty app shell.
- `raw: true` asks for the unprocessed text, which is what `fetch_url`'s `mode: 'raw'` uses for verbatim quotation.
- Timeouts are constants here (`FETCH_TIMEOUT_MS = 30_000`, `SEARCH_TIMEOUT_MS = 25_000`), not passed in per call.
- Search goes through `serp.js` (`readSerp`, `serpExpression`) and the engine catalog (`AUTO_ENGINE_ORDER`, `AUTO_SEARCH_ENGINE`, `engineById`).
- Re-exports `disposeBrowser` / `showBrowser` from `browserSession.js` and `browserFetchImage` from `image.js`, so `main.js` imports a single module.
- A diagnostic dump is available through an environment variable (`AI_DEBATE_SERP_DUMP`), for when an engine changes its markup.
- Exercises: `tests/WebPage.test.js`, `tests/SerpReader.test.js`.
