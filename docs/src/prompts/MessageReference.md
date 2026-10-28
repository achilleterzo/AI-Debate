# src/prompts/MessageReference.js

**Role** — How a participant should read and cite the `[#id]` markers in its payload.

**Notes**

- The marker is addressing metadata, not something anyone said: a model that copies it into its answer makes the transcript unreadable and, worse, makes readers believe an id is part of the argument. The block says both things — what the markers are for, and that they never belong in visible text.
- Three parts: `ID_INTRODUCTION` (everyone else's messages are announced as `[#12]`, the id never changes, your own turns arrive bare, and `get_recent_messages` returns the same ids), then either `QUOTE_INSTRUCTION` or `NO_QUOTE_INSTRUCTION` depending on whether `quote_message` is available this turn.
- `QUOTE_INSTRUCTION` sets the etiquette, not just the syntax: quote the message you are actually answering rather than your own turns, cite before or while making the point, one or two citations per turn is normal, do not announce the citation or paste the quoted text again, and never invent an excerpt.
- The variant is a parameter because a model told to cite must not be in a turn where citing is impossible — that is how it invents a citation.
- Exercises: `tests/QuoteTool.test.js`.
