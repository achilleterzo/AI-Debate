# electron/web/engines/qwant.md

**Role** — The Qwant descriptor: the one engines that needs to be told when the page is ready.

**Notes**

- Qwant renders results **client-side from its own API**. Read too early, the page shows "temporarily unavailable (HTTP 403)"; read once a result is in the DOM, it is complete. Hence `waitFor: '[data-testid="webResult"]'` — the only descriptor with a wait condition of its own (`serp.js` has the polling loop).
- `lite.qwant.com` now redirects to this page, so there is no server-rendered alternative left; that is also why the wait is a condition and not a fixed delay.
- Ads carry `data-testid="adResult"`, so the container selector never matches them.
- Snippet class names are hashed per build, so the snippet is taken structurally: `h2 + div`, the block right after the title.
- `tiers: ['primary', 'heading']` — the anchor tier is dropped here, because the page footer links to app stores and job boards: a Qwant page with no result containers has nothing else worth reading.
- `challenge` treats a literal `(HTTP 4xx)` in the page as a failure, alongside the usual captcha wording.
