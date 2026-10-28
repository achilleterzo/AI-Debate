# scripts/generate-icons.mjs

**Role** — Builds the app and PWA icons from `public/favicon.svg`, plus the Windows `.ico`.

**Notes**

- Renders the SVG with headless Microsoft Edge (`findEdgeExecutable` looks in the two standard install paths and fails loudly if neither exists), writing a temporary `scripts/.icon-render.html`, so the icons come from the same source drawing every time instead of being hand-exported.
- `iconSpecs` is the whole list of outputs: `public/icon-32.png`, `icon-192.png`, `icon-512.png`, `electron/assets/icon.png` (512) and `electron/assets/icon-256.png`.
- `encodeIco` writes the Windows icon container by hand — 6-byte header, 16 bytes of directory per image, then the PNG payloads — so no image library is needed for a format that is only a container.
- A one-off script, run manually; it is not part of the app bundle or the test suite.

