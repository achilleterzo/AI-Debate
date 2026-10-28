# electron/web/engines/index.js

**Role** — The main-process view of each search engine: catalog metadata plus how to build its URL and read its result page.

**Notes**

- `ENGINES` merges the catalog entry with the descriptor file, and it **throws at import time** if an engine is in the catalog but has no descriptor — a missing implementation fails loudly on startup instead of producing a silent empty search.
- `engineById(id)` returns `null` for an unknown id, so the caller decides what an unavailable engine means.
- The recipe for adding an engine is written in the file and is deliberately short: one descriptor file, one line in the registry, one line in the catalog, one HTML fixture in the tests.
- Exercises: `tests/SerpReader.test.js` (the fixtures drive every descriptor).
