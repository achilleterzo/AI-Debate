# src/components/ThinkingLevels.js

**Role** — The five native reasoning levels as select options, and their labels.

**Notes**

- Shared by the provider default in the AI Providers dialog and the per-participant picker, so the two always offer the same list labelled the same way — the previous duplication is exactly the kind of drift this file prevents.
- The list itself is not redefined here: `thinkingLevelOptions` maps `Debate.THINKING_LEVELS`, so adding a level is one edit in `debate/Debate.js`.
- `thinkingLevelLabel` normalizes first (`Debate.normalizeThinkingLevel`) and falls back to the raw value, so an unknown level displays as itself rather than blank.
- Not a `.jsx` file: it exports no component, only option builders.
- Which levels are *offered* for a given participant is decided by `hooks/useModelCapabilities.js`, not here.
