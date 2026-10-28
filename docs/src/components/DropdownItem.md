# src/components/DropdownItem.jsx

**Role** — One row of a dropdown menu: a button with hover, a `danger` variant and a disabled state.

**Notes**

- Hover is local state rather than `:hover`, because the rest of the styling is inline (`styles.dropdownItem` / `styles.dropdownItemDanger`) and the two cannot be mixed for one element.
- Disabled items look muted, lose the pointer and swallow the click, so nothing fires by accident.
- `danger` picks the red-tinted style from `Style.jsx` — used for destructive entries.

