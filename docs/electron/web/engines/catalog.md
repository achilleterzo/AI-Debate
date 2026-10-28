# electron/web/engines/catalog.js

**Role** — The search engines the app knows about, as plain data.

**Notes**

- It lives under `electron/` because only that folder ships in the desktop package, but it **imports nothing from Electron**: the renderer bundles it too. That is why the settings list, the tool's `engine` enum, the result labels and the Auto order can never disagree with what the main process actually implements.
- The flags: `auto` is the position in the Auto chain, `0` meaning "never tried silently"; `desktopOnly` means it needs the Electron browser and the web build cannot reach it.
- Current chain: Brave (1), Bing (2), DuckDuckGo (3) — and DuckDuckGo is the only one that is not desktop-only. Qwant and Yandex are explicit-only (Yandex because SmartCaptcha triggers quickly on automated clients); Google is explicit, desktop-only and flagged `experimental`, because consent pages and bot challenges make it a poor silent fallback.
- `SEARCH_ENGINE_IDS` includes `auto` first, and is what `settings/Settings.js` and the `web_search` tool schema use.
- `searchEngineLabel` and `searchEngineAvailable(id, { desktop })` are the two questions the UI asks; both are pure and cheap.
