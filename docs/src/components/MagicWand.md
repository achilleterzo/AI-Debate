# src/components/MagicWand.jsx

**Role** — The wand button and its popover of suggestions. One component, used wherever a field offers generated text.

**Notes**

- The whole suggestion machinery of the app is reachable from here: topic steering, participant personas, participant constraints, global rules and conclusion guidance. `SUGGESTION_MODE` is the parameter, and `isParticipantMode` / `isConstraintMode` tell it which shape of answer to expect.
- It calls `useMagicWand` (`WAND_STATUS` for busy/error states) and renders the suggestions as clickable items — accepting one writes it into the field the popover was opened for.
- The popover is positioned in a fixed box of `MODAL_WIDTH = 420` and has to clear the modal it may sit above: `ConstraintModal` repeats the z-index reasoning on its side, and the two must agree.
- The icon is sparkles (`ACCENT = '#c084fc'`) rather than a wand, because at this size a wand reads as a generic pen.
- The spinner SVG is the same one the chat uses for busy states, so "working" looks identical everywhere.
