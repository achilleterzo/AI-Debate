# electron/web/engines/google.md

**Role** — The Google descriptor. Explicit-only, desktop-only and flagged `experimental` in the catalog.

**Notes**

- The query carries four parameters whose only purpose is to get the plainest possible page: `gbv=1` (basic HTML), `hl=en`, `pws=0` (no personalisation), `filter=0` (no result filtering). Consent pages and bot challenges are why Google is not in the Auto chain.
- `GOOGLE_HOST` matches any registrable `google.` domain (`google.com`, `google.it`, `google.co.uk`), not just `.com` — the redirect and ownership rules have to work whichever domain answered.
- The basic-HTML page links through `/url?q=<target>`, and `unwrap` tries `q` then `url`; any other path is left alone.
- `ownsHost` adds `gstatic.com` and `googleusercontent.com`, whose links are assets, not results.
- `challenge` recognizes both "unusual traffic" and the `/sorry/` interstitial.
