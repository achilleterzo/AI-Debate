# src/i18n/UiStrings.js

**Role** — The interface language list, the English string table, and the resolver that merges a translation over it.

**Notes**

- `UI_LANGUAGE_OPTIONS` is ordered deliberately: Western languages first, then Eastern, each group alphabetized by its own native label — the text actually shown in the dropdown. It is also the list the *output* language picker uses, which is why an option is a language a model can be asked to write in.
- The English strings are the reference table: every key exists here, and a locale file only overrides what it translates. A missing translation therefore shows English rather than a key or an empty label.
- The tables are grouped by area (`app`, `common`, `participants`, `modes`, `moods`, `educationLevels`, `ageGroups`, `characterTypes`, `responseLengths`, `moodIntensity`, `confirmModal`, `topMenu`, …), and those names are what the components destructure.
- Option tables elsewhere carry ids or values only; this file is where they turn into words.
- `formatLanguageLabel` and the language helpers here are also used by `data/Data.js` for the export.
