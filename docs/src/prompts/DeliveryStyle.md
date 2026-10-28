# src/prompts/DeliveryStyle.js

**Role** — The default delivery style, a single exported string.

**Notes**

- It exists to keep models from writing stage directions: narrated gestures, acted pauses, cinematic scene-setting and theatrical framing are pushed out, unless a stronger instruction or the participant's core identity requires them.
- It is a default, not a lock: the escape clause ("unless explicitly required by a stronger instruction or by the participant's core identity") is what lets Role Play and a persona-heavy participant behave differently without a special case in the prompt builder.
- Kept as one constant rather than inline text in `PromptBuilder.js` because the wording is a style decision, reviewed on its own.
