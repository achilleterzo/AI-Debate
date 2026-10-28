# src/i18n/locales/index.js

**Role** — The locale registry: which language files exist, keyed by language code.

**Notes**

- `LOCALES` maps code → table: `it`, `fr`, `de`, `es`, `pt`, `ja`, `zh`, `ko`. Adding a translation means adding the file, one import and one entry here; nothing else in the app enumerates languages.
- `TRANSLATED_LANGUAGE_CODES` prepends `en`, because `UI_STRINGS` *is* the English base rather than a translation — so English is available without a file.
- Note the asymmetry with `UI_LANGUAGE_OPTIONS` in `../UiStrings.js`: that list offers many more languages as an *output* language than there are translated interfaces. The two are different things and are not meant to match.
