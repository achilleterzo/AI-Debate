import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// package.json is the single source of truth for the version: the release
// workflow bumps it, so the running build always reports the tag it came from.
const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8'))

/**
 * Drops the WOFF2 sources from the bundled emoji font, leaving WOFF.
 *
 * Backwards from every other font, and deliberately. Fontsource declares each
 * subset twice — WOFF2 first, WOFF as the legacy fallback — but the WOFF2 build
 * of Noto Color Emoji does not render in Chromium: the face loads, reports
 * `status: "loaded"` and reserves the right advance width, then paints nothing,
 * so every emoji in the app comes out as blank space. Measured on Chromium 148
 * (Electron 42) by rasterising one glyph per subset onto a canvas and counting
 * opaque pixels: 9 of the 10 WOFF2 subsets painted 0, all 10 WOFF subsets
 * painted correctly. The colour tables evidently do not survive that package's
 * WOFF2 compression.
 *
 * The cost is size — WOFF is ~7 MB against ~3.8 MB — which is the price of the
 * glyphs being visible at all. Worth re-testing on a future Fontsource or
 * Chromium release: if the WOFF2 subsets start painting, invert this plugin and
 * the bundle halves.
 */
const emojiWoffOnly = {
  name: 'noto-color-emoji-woff-only',
  enforce: 'pre',
  transform(code, id) {
    if (!id.includes('@fontsource/noto-color-emoji') || !id.endsWith('.css')) return null
    const trimmed = code.replace(/url\([^)]+\.woff2\)\s*format\('woff2'\),\s*/g, '')
    return trimmed === code ? null : { code: trimmed, map: null }
  },
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [emojiWoffOnly, react(), tailwindcss()],
  server: {
    strictPort: true,
  },
  build: {
    outDir: 'dist/web',
  },
})
