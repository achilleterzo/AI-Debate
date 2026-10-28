# src/i18n/locales/it.js

**Role** — The Italian translation.

**Notes**

- Default export: a partial copy of the English table, merged over it namespace by namespace by `UiStringsProvider`. Anything omitted falls back to English, so the file can lag behind safely.
- Same namespaces as the base (`moods`, `educationLevels`, `app`, `common`, `participants`, …). A key that does not exist in the base is inert — adding a string means adding it to `../UiStrings.js` first.
- This is the most complete translation in the folder, which makes it the practical reference when adding a new language.
