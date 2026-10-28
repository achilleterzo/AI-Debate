# src/hooks/useUpdateCheck.js

**Role** — Runs one update check at startup and exposes a manual re-check.

**Notes**

- The automatic run is guarded by a ref so React StrictMode's double mount in development does not check twice.
- Re-exports `APP_VERSION` so components read the version and the check from one place.
- `buildDevUpdateOverride` lets a development build pretend a release is available, without touching `services/Updates.js`.
- Statuses come straight from `UPDATE_STATUS`; the UI decides the wording.
- Exercises: `tests/Updates.test.js`.
