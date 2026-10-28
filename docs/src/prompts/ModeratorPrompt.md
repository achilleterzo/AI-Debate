# src/prompts/ModeratorPrompt.js

**Role** — The moderator's own prompt blocks, and what the other participants are told about the moderator.

**Notes**

- The authority boundary is conditional and precise: when a moderator exists in a mode other than containment (and not Role Play), the others are told that the moderator's *procedural* decisions are binding while their *substantive* claims are arguments like anyone else's and may be challenged. Without that line, a moderator's opinion is treated as a ruling.
- `latestModeratorDirective` is read from what the moderator **said**, via `visibleContribution`, never from a deliberation left inside the message: the directive is quoted into everyone's system prompt, so leaking reasoning there would broadcast it.
- `moderatorPermissivenessOf` clamps to 0–4 with a default of 2 and a rounding guard, so a hand-edited or imported value cannot produce a nonsense prompt.
- Mode normalization goes through `settings/Settings.js` (`normalizeModeratorMode`), the same function the UI uses.
- `externalModerationTrigger` and `toolsAvailable` let the caller describe the situation truthfully: a moderator who cannot call tools must not be told to call one.
- Exercises: `tests/ModeratorModes.test.js`.
