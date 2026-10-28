# src/components/ParticipantsPanel.jsx

**Role** — The participant editor, and the largest component of the app (about 42 kB): identity, model, provider, character type, mood and intensity, education, age group, output language, thinking level, response length, affinity and constraints — for each participant, plus the moderator settings.

**Notes**

- Everything about a participant is edited here, in one row per participant, with the per-row wand (`participantMode(index)`) offering a generated persona.
- The option tables arrive already localized from `App` (`characterTypes`, `responseLengths`, `moods`, `moodIntensity`, `educationLevels`, `ageGroups`), together with their defaults. That is why the component never imports a label from `prompts/`.
- `EndpointModelGroup` handles the provider/model pair, including the "inherit the general provider" case, so a table can mix local and hosted participants. `thinkingLevelOptions` / `thinkingLevelLabel` come from `ThinkingLevels.js` and are per-model capabilities (`hooks/useModelCapabilities.js`).
- Moderator settings live here too — mode, permissiveness and the facilitation interval, clamped with `normalizeModeratorFacilitationInterval` between `MIN_` and `MAX_MODERATOR_FACILITATION_INTERVAL` from `settings/Settings.js`.
- `running` disables the destructive and structural edits (removing, resetting, re-providering) while a debate is in progress; `onResetAffinities` and `onResetProviders` are the bulk actions.
- Its size is the main argument for keeping the per-participant field logic in small subcomponents; anything new about a participant goes here, and the file is already the place to be most careful about re-renders.
