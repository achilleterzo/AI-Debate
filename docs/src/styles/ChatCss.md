# src/styles/ChatCss.js

**Role** — The single source of truth for how a chat message looks, exported as one CSS string (`CHAT_CSS`).

**Notes**

- The live chat injects it once from `<GlobalStyles>` (`components/Style.jsx`); the HTML export inlines the very same string inside its own `<style>` tag. Anything a balloon, a tool pill or a dice note needs must live here — not in a component's inline styles — otherwise the export drifts away from the chat. It has happened before: tools used to be dumped after the text and continuations came out as separate messages.
- Everything that changes per participant travels through CSS custom properties set on the element itself, so the rules stay static: `--balloon-bg` / `--balloon-border` / `--balloon-radius` (balloon chrome), `--dice-bg` / `--dice-border` / `--dice-label` (dice note), `--label-color` (name above a balloon).
- Covers Markdown inside `.bubble` (paragraphs, lists, headings, inline and fenced code, blockquotes, tables, links, rules).
- Font stacks use `var(--mono, …)` / `var(--sans, …)` with the emoji font last, so the exported page still looks right even without the app's variables.
