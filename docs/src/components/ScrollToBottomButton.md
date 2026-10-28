# src/components/ScrollToBottomButton.jsx

**Role** — The round button that returns to the newest message.

**Notes**

- `position: sticky` with `bottom: 16` inside the timeline, so it rides along with the scroll container and needs no measurement. The wrapper is `pointerEvents: 'none'` and only the button restores `auto`, so the area around it stays clickable for the chat.
- Red and dashed on purpose: it marks a state — you are not at the bottom — rather than an ordinary control.
- Visibility is decided by `hooks/useAppLayout.js`, which uses a *further* threshold than the auto-follow distance so the button does not flicker while the reader hovers near the edge.
- The label comes from `UI_STRINGS.app.backToBottom`.
