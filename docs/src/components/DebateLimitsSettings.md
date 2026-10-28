# src/components/DebateLimitsSettings.jsx

**Role** — The debug switch in the settings row.

**Notes**

- The name is historical: the turn and timeout limits it once held now live with the debate controls, and what is left is the debug toggle.
- Amber when on (`#f59e0b`), matching the warning tint of `PromptEstimateBadge`: debug is useful but changes what the app shows, so it should not look like an ordinary preference.
- Same hand-built switch markup as `AffinitySettings`, and the same idea for the `title`: it explains the current state rather than repeating the label.
- `marginLeft: 'auto'` puts it at the far end of the row, away from the controls the user touches on every session.
- `debugMode` is what makes `SummaryPanel`'s inspection links appear.
