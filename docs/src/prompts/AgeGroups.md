# src/prompts/AgeGroups.js

**Role** — The age groups of a participant, each with the voice it implies.

**Notes**

- Five entries indexed 0–4: child (\~8–11), teenager (\~13–18), **2 = unspecified** (`constraints.default: null`), mature adult (\~45–65), elderly (70+).
- The index is the value and the middle slot is the "no constraint" case. That is why `App` localizes the labels by *index* while education and character types use `value`: here the value is a number and `null` cannot be used without shifting the scale.
- Each group is written as behaviour, not as a stereotype to imitate: vocabulary, sentence length, pace, what the person references.
- Same constraint shape as the other option tables.

