# src/components/ProviderSettingsDialog.jsx

**Role** — The dialog shell around `ProviderSettings`: backdrop, box, title, close on outside click.

**Notes**

- A thin wrapper that separates *framing* from *content*: the providers UI can then be rendered anywhere (the settings modal, the per-participant provider button) with the same chrome.
- Clicking the backdrop closes (`onClick={onClose}` on the overlay); clicking inside stops propagation, so the dialog is not dismissed while it is being used.
- Size is `min(94vw, 720px)` by `min(88vh, 680px)` with `overflow: hidden` on a flex column, so the tab content scrolls inside a fixed frame instead of resizing the box.
- Every other prop is forwarded unchanged (`...providerProps`) — the wrapper knows nothing about providers.
