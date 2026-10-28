# src/prompts/ReasoningLeak.js

**Role** — Recognizes and removes reasoning a model wrote into the message instead of into the thinking channel.

**Notes**

- A think tag is what a thinking-capable model emits when the thinking channel is not used. The others show up on models with *no* thinking capability: asked to "deliberate in X, answer in Y", such a model invents a block for the deliberation and leaves it in the prose — in the reasoning language, above the actual contribution.
- None of it is the contribution. It is stripped as the turn streams, and again wherever a stored message becomes model input: a transcript written before the cleaning existed still carries such a block, and every later turn would otherwise ship one participant's private monologue to the others as if it had been said out loud.
- `REASONING_TAGS` covers `think`, `thinking`, `thought(s)`, `reasoning`, `reflection`, `deliberation`, `scratchpad`, `inner_monologue`.
- Closing tags are matched leniently on purpose: a model improvising the markup does not always close what it opened with the same name — an opening tag answered by a different closing tag is common enough that requiring a matching pair made the block invisible to the stripper.
- Also exports `visibleContribution`, which is the single way the rest of the app asks "what did this participant actually say": used by `tools/ConversationTools`, `tools/QuoteTool`, `prompts/ModeratorPrompt`, `data/Session`, `debate/Debate`.

