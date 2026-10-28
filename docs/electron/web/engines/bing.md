# electron/web/engines/bing.js

**Role** — The Bing descriptor: URL, result selectors, click-through unwrapping, owned hosts, challenge text.

**Notes**

- Bing wraps organic links in `bing.com/ck/a?...&u=a1<base64url(target)>`. Left wrapped, the link looks Bing-owned and the result gets discarded by the "engine owns this host" rule — so `decodeClickThrough` unwraps it, base64url-decoding after the `a1` prefix and accepting only an `http(s)` target.
- `serp` selectors are ordered preferences within each tier: container `li.b_algo`, title `h2 a`, snippet `.b_caption p` then the line-clamp variants then any `p`.
- `ownsHost` covers `bing.com`, `microsoft.com` and `msn.com` — the other hosts whose links are navigation, not results.
- `challenge` is Bing's own wording for a bot check, so it is recognized as a challenge rather than as an empty page.
- Descriptors are pure data plus small helpers: the judgement about tiers and de-duplication stays in `serp.js`.

