# src/utils/Slug.js

**Role** — Turns a debate topic into a file name.

**Notes**

- Unicode-aware on purpose: `NON_SLUG_CHARS` keeps letters, numbers and combining marks from *any* script, so CJK, Arabic, Devanagari, Thai and Cyrillic survive instead of being wiped out. Everything else — punctuation and symbols — is dropped, which already covers the characters unsafe in file names on Windows, macOS and Linux.
- URLs are removed first (a topic that is a link would otherwise dominate the name), the result is lowercased, spaces become hyphens, cut at 48 characters by default and stripped of trailing hyphens so the extension never follows a dash.
- Used by `data/Data.js` and `data/Session.js`; exercises: `tests/Slug.test.js`.
