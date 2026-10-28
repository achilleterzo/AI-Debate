# src/prompts/AffinityPrompt.js

**Role** — The block that tells a participant how it feels about the others.

**Notes**

- Affinity is a per-pair weight from -1.00 (strong conflict, distrust, hostility) to +1.00 (strong alignment, trust, support), and the block lists it per name with an explicit sign.
- The scale and its meaning are stated in the prompt itself, because a bare list of numbers would be read as arbitrary.
- Entries are dropped when the other participant no longer exists, when the weight is not finite, and when it is exactly 0 — a zero carries no information and only lengthens the prompt.
- The instruction is about *tone and willingness* to agree, build on or push back: affinity is not meant to dictate positions, only the register in which positions are held.
- The block is empty (`''`) when there is nothing to say, and `debate/PromptBuilder.js` skips it entirely.

