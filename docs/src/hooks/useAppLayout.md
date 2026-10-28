# src/hooks/useAppLayout.js

**Role** — Layout and scrolling behaviour: the two-column switch, auto-follow while streaming, and the scroll-to-bottom button.

**Notes**

- `TWO_COLUMN_MIN_WIDTH` (from `settings/Settings.js`) decides the layout; the same breakpoint is repeated in `src/index.css`, and the two must stay in sync.
- Auto-follow triggers only within `FOLLOW_DISTANCE_PX = 80` of the bottom, so scrolling up to read stops the chat from dragging the reader back down.
- The button's appearance threshold is deliberately *further* than the follow distance: with a single threshold both edges flipped the button in and out while the reader hovered near it, and every flip is a render.
- Returns the refs and flags the shell needs; no styling decisions live here.
