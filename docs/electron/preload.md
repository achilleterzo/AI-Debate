# electron/preload.js

**Role** — The bridge exposed to the renderer as `window.desktop`.

**Notes**

- `contextBridge.exposeInMainWorld('desktop', …)` with an explicit list of channels — the renderer gets exactly these functions, not `ipcRenderer` itself. That list is the app's whole native surface: `aiStatus`, `aiLogin`, `aiListModels`, the chat stream, cancel, the hosted-key calls, the web calls (search, page, image, browser window).
- `isElectron: true` is the flag the renderer checks to know whether a desktop-only capability exists (e.g. `services/Images`, `tools/ImageTool`).
- The stream is a **per-request channel**: `ai-chat-stream:${requestId}` carries the events, and `aiChatStreamCleanup(requestId)` removes the listeners. Without the per-request channel, two participants streaming at once would cross their events.
- The comment on the hosted providers states the security reason for the whole design: the API key is stored and used in the main process, so it never enters the renderer and never appears in a request the renderer can see.
