# src/i18n/UiStringsProvider.jsx

**Role** — Fills the strings context with the English base merged with the chosen locale.

**Notes**

- `mergeUiStrings` merges **namespace by namespace**: a locale only has to carry the strings it actually translates, and anything it leaves out falls back to English — a partially translated file is a valid file, and a missing key can never produce an empty label.
- The merge is memoized on `lang`, so switching language rebuilds once and every consumer re-renders from a stable object.
- An unknown `lang` simply yields the English base (`LOCALES[lang]` is undefined, and `mergeUiStrings` returns the base untouched).
- Mounted by `App` — `UiStringsProvider` wraps `AppInner` — which is why `App` is the one place that receives the raw settings.
