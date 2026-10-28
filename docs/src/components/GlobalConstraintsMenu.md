# src/components/GlobalConstraintsMenu.jsx

**Role** — The table-wide constraints, behind their own button.

**Notes**

- They used to sit as a chip row above the topic box, between the transcript and the field being typed into — close enough to the composer to read as part of the message being written, so users took them for something attached to this turn rather than rules already in force for the whole table. They now live in a list that opens from the button that already counts them, which is where someone goes when they want to know what the rules are.
- Opens and closes on its own state, and closes on an outside click (the same pattern as `TopMenu`).
- Add, edit and delete are three separate callbacks: editing history is not the same action as adding a rule, and the parent decides where the history is kept.
- `RemoveButton` gives the delete control its affordance.
