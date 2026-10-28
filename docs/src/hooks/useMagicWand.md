# src/hooks/useMagicWand.js

**Role** — The React side of the magic wand: runs the request `services/Suggestions.js` formats and hands the parsed suggestions to the caller.

**Notes**

- One hook serves every wand in the app — topic, participant, constraint, global rule, conclusion guidance — because the difference is the mode passed in, not the machinery.
- Knows the vocabulary the prompts are written with (character types, moods and intensity, education levels, age groups, `outputLanguagePhrase`), so suggested options come back in terms the configuration UI can apply.
- Streams through `debate/Stream.js` like any other request, which means it can be aborted.
- Formatting and parsing stay in `services/Suggestions.js`; this file only holds state and lifetime.
