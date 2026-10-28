# src/utils/Markdown.js

**Role** — The one configured Markdown pipeline. Everything that turns text into HTML goes through here — the chat, the exports — so a rule written once holds everywhere, and nobody can reach a laxer parser by importing `marked` directly.

**Notes**

- One `Marked` instance is configured once. The previous setup mutated the global `marked` singleton with `setOptions`, which silently applied one module's renderer to another module's parse calls.
- `html` escapes raw markup: markup typed by a person, or produced by a model, is content, not instructions for the browser. It is also the only way `Array<String>` survives being written out.
- Link targets are an **allowlist** (`SAFE_URL_RE`): `http(s)`, `mailto:`, `tel:`, anchors, and relative paths. A blocklist was the old approach, and `javascript:` and `data:text/html` were both reachable — enumerating every dangerous scheme is a game you lose once. Relative targets stay permitted because the exported HTML uses them.
- A rejected target is *shown* rather than dropped, so the reader can see what the label points at.
- `link` renders its label with `parseInline`, so the label is Markdown (and passes through the escaping rules) instead of being spliced in untouched.
- `markedInline` renders one line and strips the wrapping paragraph — used by the chat for short labels.
- Exercises: `tests/Markdown.test.js`.
