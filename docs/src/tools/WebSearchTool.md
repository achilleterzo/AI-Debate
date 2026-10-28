# src/tools/WebSearchTool.js

**Role** — The `web_search` function definition exposed to the models.

**Notes**

- The definition is OpenAI-compatible (`type: 'function'`, `function.name/description/parameters`) and is only a *contract*: execution stays in `services/Web.js`, so the tool's shape and its implementation can evolve separately.
- Parameters: `query` (required) and an optional `engine` override, whose enum is `SEARCH_ENGINE_IDS` from `settings/Settings.js` — the same list the settings screen and the Electron catalog use. Omitting it means the user's default; `auto` tries the enabled browser engines in order.
- `constraints` carries the imperative the prompt builder injects: when current external information is needed, search through the structured interface *before* making the claim, never simulate a search or invent its result.
- Exercises: `tests/WebSearchTool.test.js`.
