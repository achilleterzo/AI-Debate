# src/components/RemoveButton.jsx

**Role** — The X that removes a chip or a list row.

**Notes**

- It replaced a typed "x", which at 11px and in the same colour and weight as the text beside it read as the last letter of the label rather than as a control. The glyph is now a stroked SVG at a fixed size with its own hit area and hover state, so it is visibly a button before it is clicked.
- Defaults: `color = '#7f629d'`, `hoverColor = '#f87171'` (red on hover, confirming the destructive intent), `size = 14`.
- `title` doubles as `aria-label`, so the button is reachable by a screen reader; the negative margin keeps the hit area from adding visual padding to the row.
- Used by `AttachmentsChips`, `TopicComposer` (history rows), `ParticipantsPanel` and the constraint lists.
