# src/Main.jsx

**Role** — The entry point of the renderer: mounts `<App />` into `#root` inside `StrictMode`.

**Notes**

- Imports the Noto Color Emoji stylesheet from `@fontsource` on purpose. The chat draws its own furniture (tool pills, dice, the moderator marker) with emoji, and the desktop build has no network to fetch a font from, so the emoji must be bundled to look the same everywhere. The stylesheet declares one `@font-face` per Unicode range, so a session loads only the ranges it shows.
- Imports `index.css` last, after the font, so the app's own variables win.

