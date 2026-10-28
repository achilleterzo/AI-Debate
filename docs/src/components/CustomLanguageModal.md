# src/components/CustomLanguageModal.jsx

**Role** — The free-text dialog behind "Other (specify)…" in the output language picker.

**Notes**

- Deliberately *not* a picker: the point of the custom entry is to name languages the fixed list cannot hold — dialects, historical or invented ones — so the value goes to the model as written.
- The sentinel `OUTPUT_LANG_CUSTOM` never reaches storage: choosing it opens this dialog, and what is saved is the typed text (`prompts/LanguagePrompt.js`).
- `state.initialValue` seeds the field, so re-opening it on an existing custom language edits rather than replaces.
- Used by `SummarySettings` and `DebateWizard`, both of which offer the same picker.
