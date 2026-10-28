# src/components/Style.jsx

**Role** — The inline-style objects the components share, plus `GlobalStyles` (which injects `CHAT_CSS`) and a few style helpers.

**Notes**

- `styles` is one object of plain style literals (`app`, `header`, `headerTop`, `headerBody`, `settingsRow`, …). Components spread them rather than redefining layout, which is how the panels stay visually consistent without a CSS framework — Tailwind is present, but the app itself is built on these.
- `GlobalStyles` injects `CHAT_CSS` from `styles/ChatCss.js` once. That matters beyond the chat: the export inlines the very same string, so any rule a balloon or a tool pill needs must live there, not in a component.
- Helpers for third-party `react-select` styling live here too (`moodSelectStyles`, `modelSelectStyles`, `formatMoodOption`) — a select's chrome cannot come from the `styles` object, so it needs its own mapping in the same file.
- The `eslint-disable react-refresh/only-export-components` at the top is deliberate: this module exists to export non-component values alongside the component.
