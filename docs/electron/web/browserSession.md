# electron/web/browserSession.js

**Role** — One long-lived, hidden Chromium window that every search, page fetch and image download goes through, one at a time.

**Notes**

- Keeping the window and its cookie jar alive between requests is deliberate: a browser that accepted a consent banner once and keeps its cookies looks like a person, while a brand-new profile on every request looks like a bot. The partition name (`persist:ai-debate-search`) is the one searches already used, so existing consent cookies carry over.
- A single queue serialises the requests (`queue` is a promise chain), so two participants fetching at once do not fight over one window.
- `RENDER_SETTLE_MS = 900` and `CONSENT_SETTLE_MS = 1_200`: the waits before extracting, and after a consent interaction, so a page that renders late is not read as empty.
- `assertPublicHttpUrl` (`urlSafety.js`) is the guard before any navigation — a tool-supplied URL is attacker-controlled input.
- `showBrowser` / `disposeBrowser` let the user watch what a participant is reading; closing the window only hides it, so the session survives.
- `DNS_CACHE` and the secured-session `WeakSet` avoid repeating per-request work on a window that is reused.
