# src/prompts/DefaultGeneralPersonalityInstructions.js

**Role** — The default decision order a participant follows when its instructions conflict.

**Notes**

- The precedence list, in order: (conditional) system override → core identity → interpersonal constraints → affinity weights → mood. A single explicit order is what stops a model from resolving a conflict differently on every turn.
- The second half is the anti-repetition rule: when repetition is detected, break optimal coherence and prioritise novelty over consistency. It targets the failure mode of a table that keeps agreeing with itself.
- Editable in the interface: this is only the default. The constraint block receives whatever the user has configured (`generalPersonalityInstructions`), never the constant directly.

