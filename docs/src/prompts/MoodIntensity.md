# src/prompts/MoodIntensity.js

**Role** — How strongly a mood is expressed: five levels, 0 to 4, each with its own instruction.

**Notes**

- The scale is a sentence per level rather than a number the model must interpret: 0 "barely noticeable", 1 "lightly, secondary to the substance", 2 "clearly and consistently, without overwhelming the content", 3 "dominant and persistent, visibly shaping every response", 4 "all-consuming, overrides any temptation toward neutrality".
- Same `constraints: { default: … }` shape as `Moods.js`, so a mode-specific wording can be added later without changing the consumers.
- Values are integers; `App` localizes the labels by index, and the prompt builder picks the entry by `value`.
- Exercises: `tests/Moods.test.js`.
