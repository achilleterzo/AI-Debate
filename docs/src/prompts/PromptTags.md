# src/prompts/PromptTags.js

**Role** — The list of every tag the app wraps prompt material in, and the function that strips them from an answer.

**Notes**

- These are delimiters *we* write, never prose a participant would produce, so a model echoing one back is leaking scaffolding — either the bare tag or, as happens with the reasoning ones, a whole block of internal monologue dressed as an answer.
- Keeping the list in one place keeps the emitting side and the cleaning side in agreement. A test walks a built prompt and fails if a tag ever appears in the prompt without being listed here.
- Two passes: a **closed** block is removed entirely (what a model puts inside one of our delimiters is its own scaffolding talk, not the contribution it was asked for), and whatever is left — an unmatched open or close — is removed as a stray delimiter.
- The tags read as a map of the prompt: `identity`, `character_profile`, `constraints`, `debate_mode`, `conversation_context`, `tool_protocol`, `turn_request`, …
- `debate/Stream.js` calls `stripPromptScaffolding` on every chunk path, so no provider can slip a tag into the transcript.
