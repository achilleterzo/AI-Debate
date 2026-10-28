# src/components/DebateWizard.jsx

**Role** — The setup wizard: it generates a topic and a cast of participants from a short description.

**Notes**

- State and prompts live in `hooks/useDebateWizard.js` (`WIZARD_STATUS`, and the participant count bounds `WIZARD_MIN_PARTICIPANTS` / `WIZARD_MAX_PARTICIPANTS`); this file is the dialog.
- The generated cast lands in the participant editor rather than replacing it, so the wizard is a way to fill in a table, not a separate mode of the app.
- `languageOptions` is built from `UI_LANGUAGE_OPTIONS` once at module level, and `OUTPUT_LANG_CUSTOM` / `isCustomOutputLanguage` give the same "Other (specify)…" behaviour as `SummarySettings`.
- The comment near the top records a styling detail worth keeping: the participant-row select styles are built for a narrow column beside a participant, so a full-width wizard column needs its own adaptation instead of the same literal styles.
- Exercises: `tests/WizardTopic.test.js`.
