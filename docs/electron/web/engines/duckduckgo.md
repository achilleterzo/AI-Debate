# electron/web/engines/duckduckgo.md

**Role** — The DuckDuckGo descriptor, and the only engine available in the web build.

**Notes**

- It uses the **HTML endpoint** (`html.duckduckgo.com/html/`), not the JavaScript app: there is no script to run, so the page can be read even with a plain fetch. That is what makes it the fallback when the Electron browser is not there.
- Every organic link goes through `duckduckgo.com/l/?uddg=<target>`, so `unwrap` uses the shared `redirectTarget(url, 'uddg')` helper from `hosts.js`.
- Selectors are the stable pair `.result`/`.web-result` with `.result__a` and `.result__snippet`.
- `challenge` matches DuckDuckGo's own wording ("anomaly", "bots use duckduckgo"), so an automated-client block is reported as a challenge rather than as zero results.
- In the Auto chain it is last (`auto: 3`), because it is the one that works everywhere.
