# src/dataset/RandomNames.js

**Role** — The pool of first names a new participant gets when the user does not type one.

**Notes**

- About 160 names, deliberately mixed across cultures so the default cast does not look like one country's office.
- The only consumer is `debate/Debate.js`, which draws from this pool when a participant needs a default name; no other module invents one.
- No labels or translations: a name is not a UI string.

