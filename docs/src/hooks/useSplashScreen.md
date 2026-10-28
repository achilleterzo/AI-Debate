# src/hooks/useSplashScreen.js

**Role** — Visibility of the welcome screen plus the "show at startup" preference.

**Notes**

- Visibility is seeded from the stored preference on the first render only, so unticking the box *inside* the splash saves the choice for the next launch without closing the screen the user is still reading. That is the whole reason the hook exists.
- Persists through `data/Storage`; the preference key sits with the other dismissible ones in `settings/Settings.js`.
- Exercises: `tests/SplashPreference.test.js`.
