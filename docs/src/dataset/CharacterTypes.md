# src/dataset/CharacterTypes.js

**Role** — The character-type options for a participant: `null` (a plain person), `historical`, `public`, `fictional`.

**Notes**

- Values only, no labels: `App` maps each `value` through `UI_STRINGS.characterTypes`, falling back to the raw value. That is why the file is nine lines long.
- `null` is the default participant type (`person` in the export, see `data/Session.js`). It is a deliberate option rather than an absent one, so the picker can offer "no particular type".
- Used by `App`, `Debate`, and the wizard/wand prompts (`services/Suggestions.js`), which describe generated personas in these terms.
