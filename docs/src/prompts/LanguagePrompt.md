# src/prompts/LanguagePrompt.js

**Role** — How the output language is named in a prompt, and how a custom one is recognized.

**Notes**

- `OUTPUT_LANG_CUSTOM = '__custom__'` is the sentinel for the "Other (specify)…" entry of the picker. It is **never stored**: choosing it opens the free-text modal (`components/CustomLanguageModal.jsx`), and what lands in `uiLang` is the typed text itself. Anything outside the fixed list is therefore a custom language, which is all `isCustomOutputLanguage` checks.
- The reason the custom modal is free text rather than a picker: a custom entry exists to name languages the fixed list cannot hold — dialects, historical or invented ones — so the value goes to the model as written.
- `outputLanguagePhrase` quotes a listed language with its ISO code, but names a custom one on its own rather than dragging a nonsensical "language code: Napoletano" into every prompt.
- `buildLanguagePrompt` produces the block `debate/PromptBuilder.js` inserts; the wizard and wand prompts use `outputLanguagePhrase` for the same wording everywhere.
