# src/prompts/EducationLevels.js

**Role** — The education levels of a participant, each with the instruction it stands for.

**Notes**

- Six entries from `null` (unspecified) through `street`, `primary`, `proficient`, `academic`, `expert`. Only the last four are formal schooling; `street` is included because reasoning from lived experience is a distinct and useful voice, not a worse one.
- Each level shapes vocabulary and syntax, not intelligence: `primary` explicitly allows occasional grammatical mistakes, `expert` expects specialist frameworks and scholarly debate.
- `null` maps to `constraints.default: null`, the "no instruction" case handled by `resolveConstraint`.
- Same constraint shape as moods and intensity, so the prompt builder treats all three identically.
- `App` localizes the labels; the wizard and wand prompts (`services/Suggestions.js`) offer the same `value`s when generating a persona.
