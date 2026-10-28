# src/components/PromptEstimateBadge.jsx

**Role** — The small amber pill showing the estimated size of the next prompt.

**Notes**

- Renders nothing when there is no estimate (`if (!estimate) return null`), so it can be mounted unconditionally.
- When a `request` is available the pill becomes a button that opens the payload inspector; without one it is disabled but still visible, so the number is readable either way. The click stops propagation, because the badge usually sits inside a collapsible row.
- `compact` switches the margin and alignment for use inside a line of text rather than below a block.
- Colour is the amber `#f59e0b` on `#1f1a0d`: a warning tint, not an error — the number is information, not a failure.
