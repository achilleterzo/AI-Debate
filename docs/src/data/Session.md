# src/data/Session.js

**Role** — Import of a previously exported session: turns the human-readable export back into internal state.

**Notes**

- The export writes labels where the app stores values, so this module owns the reverse mapping: `responseLengthFromExport` undoes the `Verbosity: ` prefix and maps `free` back to the free-length sentinel; character type falls back to `person` (`EXPORT_DEFAULT_CHARACTER_TYPE`).
- Normalizes messages on the way in, stripping leaked reasoning (`stripLeakedReasoning`) and keeping the visible contribution (`visibleContribution`) from `prompts/ReasoningLeak`, so an imported session looks like the one that was exported.
- Works together with `data/Data.js` (writer) and `utils/Slug.js` (`topicToSlug` for re-derived file names).
