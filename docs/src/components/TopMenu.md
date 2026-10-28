# src/components/TopMenu.jsx

**Role** — The dropdown menu itself, with its submenu and its outside-click handling.

**Notes**

- Self-contained: it opens and closes on its own (`menuOpen`, `newOpen`) and closes when a click lands outside `menuRef` — the parent does not manage that.
- Takes `DropdownItem` as a prop instead of importing it, which keeps the menu independent of the item component and avoids a circular import through `HeaderTop`.
- The command set: save/load snapshot, prompt settings, splash screen, wizard, new chat, fork, export items, and a release indicator from `updateAvailable`.
- `canFork` gates the fork entry; `running` is used to decide what is meaningful while a debate is in progress.
