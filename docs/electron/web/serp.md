# electron/web/serp.js

**Role** — Reading a search result page, in two halves.

**Notes**

- `collectSerpCandidates` runs **inside the page** (serialized with `toString`), so it cannot see this module: it only gathers raw candidates and knows nothing about engines beyond the selectors it is handed as JSON.
- Everything that takes judgement — redirect unwrapping, engine-owned links, de-duplication, challenge detection — happens in `readSerp`, in Node, where it is testable (`tests/SerpReader.test.js`). That split is the reason this file is readable at all.
- Candidates come in **tiers of decreasing trust**: `primary` (the engine's own result containers), `heading` (any linked H3, which survives class-name rotations), `anchor` (any visible link, the last semantic signal left). A later tier is only consulted when every earlier one produced nothing — so a site redesign degrades instead of breaking.
- Limits: `MAX_RESULTS = 8`, `MAX_CANDIDATES_PER_TIER = 200`, `WAIT_FOR_MS = 6_000` with `WAIT_POLL_MS = 150` polling, `SNIPPET_MAX_CHARS = 400`.
- `GENERIC_CHALLENGE` detects a bot check ("unusual traffic", "not a robot", "captcha", "before you continue") and reports it as such, instead of returning an empty result list that looks like "no results".
- The engine-specific selectors live in `engines/`; this module is engine-agnostic.
