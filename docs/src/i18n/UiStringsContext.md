# src/i18n/UiStringsContext.js

**Role** — The strings context and its hook.

**Notes**

- The context is created with the English table as its default value, so a component rendered outside the provider still finds strings instead of `undefined`.
- The hook `useUiStrings()` is what every component imports, and this file is the module they import it *from*.
- The split between this file and `UiStringsProvider.jsx` is deliberate: Fast Refresh only treats a module as a boundary when everything it exports is a component. Housing the provider here too made every edit to a locale file invalidate past this module and reload the page instead of refreshing the strings in place.
