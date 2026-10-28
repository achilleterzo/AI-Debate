# src/components/AppModals.jsx

**Role** — The single mount point for every dialog of the app, so `App` renders one element instead of six.

**Notes**

- Holds: the payload inspector, the constraint dialog, the custom-language dialog, the prompt-settings dialog, the confirm dialog and the provider dialog. Each is rendered only when its state object is present (`payloadModal`, `constraintModal`, …), which is how opening and closing a modal is expressed as a single state value rather than a boolean plus data.
- Groups the props by dialog, so adding a modal means adding one group here and one state in `App`.
- Passes `modelSelectStyles` and `moodSelectStyles` down, because a `react-select` rendered inside a modal cannot read the app's inline styles.
- `wand` is passed in rather than created per dialog: one wand instance serves the constraint and prompt dialogs, and `ConstraintModal` raises the z-index so the popover clears the dialog (see the note in that file).
- The constraint dialog also receives the global-suggestion history and its delete handler, so a rule suggested once can be reused or dropped.
