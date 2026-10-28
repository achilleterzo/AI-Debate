# src/components/ConfirmModal.jsx

**Role** — The generic confirmation dialog: a question, a confirm label and a cancel.

**Notes**

- Everything variable comes from `state` — the message, the confirm label and whether the action is destructive — so one component serves every confirmation instead of each caller growing its own.
- Backdrop click cancels (`onClick={onCancel}` on the overlay), inside clicks stop propagation. Cancel is the safe default, which is why the backdrop does not confirm.
- Sized `min(92vw, 460px)` and laid out as a column, so a long message wraps and the buttons stay in place.
- Labels come from `UI_STRINGS.confirmModal` plus `common`, not from the caller — a confirmation should read the same wherever it appears.
