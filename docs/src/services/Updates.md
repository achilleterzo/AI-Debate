# src/services/Updates.js

**Role** — The update check against GitHub releases.

**Notes**

- States in `UPDATE_STATUS` (`idle`, `checking`, `upToDate`, `available`, `error`) and the three failure reasons in `UPDATE_ERROR`: `unreachable` (offline, DNS, proxy, firewall), `http` (answered, but without a usable status), `unsupported` (no usable `fetch` in this environment). The distinction is user-facing: "you are offline" is a different message from "GitHub answered oddly".
- `parseVersion` accepts both `1.2.0` and the `v1.2.0` form used by release tags, and keeps the pre-release suffix, so a pre-release is comparable.
- Endpoint and timeouts come from `settings/Settings.js` (`UPDATE_REPO`, `UPDATE_RELEASES_URL`, `UPDATE_CHECK_TIMEOUT_MS`) — nothing is hard-coded here.
- Consumed by `hooks/useUpdateCheck.js`.
