# src/tools/DiceTool.js

**Role** — `roll_dice`, available in Role Play mode only.

**Notes**

- The tool call belongs to the participant who invokes it; only the resulting numbers are shared with the table. The description states exactly that, so a model knows it is not granting dice to anyone else.
- `count` 1–100, `sides` 2–1000. `rollDice` clamps anything outside those ranges instead of trusting the model's arguments.
- Randomness comes from `crypto.getRandomValues` with rejection sampling against the modulo bias (`secureRandomInt`); `Math.random` is only the fallback for an environment without Web Crypto.
- Constraints say it twice, because this is the tool most likely to be faked: call the tool *before* describing the outcome, and afterwards use the returned numbers exactly — do not replace them with a narrated result.
- `formatDiceRoll` renders `(1d20) -> 17` or `(3d6) -> [2+5+4] = 11`.
