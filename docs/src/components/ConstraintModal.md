# src/components/ConstraintModal.jsx

**Role** — The dialog for writing a constraint: one participant's constraint or a table-wide rule.

**Notes**

- Two z-index constants, each with its reason:
  - `WAND_Z_INDEX = 1200` — the wand popover has to clear this modal, which already sits above the app.
  - `MENU_PORTAL_Z_INDEX = 1150` — the saved-constraint list is taller than the room left under its field and the dialog clips its own overflow to keep the rounded corners, so the menu is rendered into the body to escape that box; its z-index then has to clear the dialog it is escaping from.
- The wand is wired to `constraintMode(...)` (or the global-rule mode), and the field is capped at `MAX_CONSTRAINT_CHARS` from `services/Suggestions.js`.
- `state` carries the initial text and the target, so the same dialog serves add and edit; `globalSuggestions` with `onDeleteGlobalSuggestion` is the reusable history of table-wide rules.
- `selectStyles` comes from the caller because a `react-select` inside a modal cannot read the app's inline styles.
