# src/hooks/useSnapshots.js

**Role** — Saving and restoring a session snapshot.

**Notes**

- A snapshot reads state through `refs`/`topicRef`: the composer keeps its text in a ref so typing does not re-render the app, which means the current text is only readable at the moment of the click.
- Restoring passes through `data/Session.js` and `normalizeDebateMode`, so a snapshot saved by an older version with a mode that no longer exists still loads.
- An unreadable snapshot produces `invalidSnapshotMessage` rather than restoring half of it.
- `onExportImported` is called when the restored snapshot came from an exported file, so the UI can show the import notice.
