# electron/main.js

**Role** — The Electron main process: window lifecycle, the IPC surface the renderer talks to, encrypted storage of API keys, the CLI clients, and the web bridge.

**Notes**

- `PROVIDER_LABELS`, `CLI_PROVIDERS = ['codex', 'claude']` and `KEY_PROVIDERS = ['ollama-cloud', 'openrouter', 'gemini']` are the three kinds of provider: desktop clients driven as child processes, hosted APIs reached with a key, and local Ollama which needs neither.
- API keys are encrypted with the operating system's own facility (`safeStorage`), **one file per provider**, named after it, so a key entered for one provider can never be read as another's. Ollama Cloud keeps the historical file name, so a key saved before the other providers existed still loads.
- `aiChildren` and `apiRequests` are the live child processes and in-flight API requests, keyed by request id: that is how a cancel from the renderer reaches the right stream.
- `CODEX_SANDBOXES` and `CLAUDE_MODELS` describe the CLI clients' own options; the renderer sends one per request.
- Delegates: CLI stream translation to `cliStream.js`, Windows shim resolution to `cliShim.js`, and all web access to `web/index.js` (`browserSearch`, `browserFetchPage`, `browserFetchImage`, `showBrowser`, `disposeBrowser`).
- Window state (size, position) is persisted with `electron-window-state`; external links open through `shell`, never inside the app window.
