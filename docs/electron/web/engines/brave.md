# electron/web/engines/brave.md

**Role** — The Brave Search descriptor.

**Notes**

- `url` adds `source=web` to the query, which keeps the results to the web tab rather than mixing in news and video.
- No click-through wrapping to undo: `unwrap: () => null`. Brave links point straight at the target, so this is the simplest descriptor and a good model for a new engine.
- Three selectors per field, ordered: the primary class, a `data-testid`/`data-type` variant, and a generic fallback — the shape that survives a class-name change.
- `ownsHost` is `brave.com` only.
- `challenge` catches Brave's proof-of-work captcha (`pow captcha`) and the generic "verify you are human".
