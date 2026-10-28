# src/components/ImportNoticeModal.jsx

**Role** — The notice shown after a session is imported: what was loaded and what that means.

**Notes**

- The icon is drawn for this dialog alone — a page with an arrow coming *into* it, "the file went in, not out" — so the import cannot be mistaken for an export at a glance.
- A dismissible notice: `useSplashScreen`-style preferences are stored with the other dismissible keys in `settings/Settings.js` (`DISMISSIBLE_NOTICE_KEYS`, `DEFAULT_SHOW_IMPORT_NOTICE`), so a user who has read it is not shown it again.
- Shown by `App` when `hooks/useSnapshots.js` reports that the restored snapshot came from an exported file (`onExportImported`).
- Exercises: `tests/NoticePreferences.test.js`, `tests/ImportExportedSession.test.js`.
