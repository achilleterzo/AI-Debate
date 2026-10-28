# src/hooks/useAppSettings.js

**Role** — All persisted application settings in one hook, with their defaults, normalization and save.

**Notes**

- Exports `useAppSettings` (the live state) and `usePersistedAppSettings` (the writing side), so `App` can read settings and the settings UI can save them without duplicating the defaults.
- Every default comes from `settings/Settings.js` (`DEFAULT_MAX_TURNS`, `DEFAULT_DYNAMIC_AFFINITY`, `DEFAULT_SUMMARY_*`, `DEFAULT_PAGE_BLOCK_KB`, `DEBUG_MODE_STORAGE_KEY`, …); none is defined inline, so the app and the tests agree on one set of values.
- Reads and writes through `data/Storage`, and calls `Debate` / `Web` caches when a setting invalidates them (clearing the web caches when the search engine or page limits change).
- The single place where a new user preference should be added.
