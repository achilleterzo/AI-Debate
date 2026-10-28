# src/index.css

**Role** — The global stylesheet: Tailwind entry point plus the small set of rules that everything else assumes.

**Notes**

- Declares the design tokens as CSS variables on `:root` (`--bg`, `--surface`, `--border`, `--text`, `--text-muted`, `--accent`, `--user-bg`) and the font stacks.
- `'Noto Color Emoji'` is listed **last** in the stacks on purpose. Its subsets also cover digits, `#` and `*` (the keycap pieces), so ahead of the text fonts it would repaint ordinary numbers as emoji.
- Text selection is disabled by default and re-enabled for inputs, `.bubble`, `.selectable` and code, which is what makes the chat feel like an app rather than a page.
- `#root` is capped at 800px and centred; the `min-width: 1200px` media query removes the cap for the two-column layout. The breakpoint must stay in sync with `TWO_COLUMN_MIN_WIDTH` in `src/settings/Settings.js`.

