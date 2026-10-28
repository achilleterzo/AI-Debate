# src/prompts/ResponseLengths.js

**Role** — How long a participant's answers may be: `short` (default), `medium`, `detailed`, or `null` for no limit.

**Notes**

- Every level is written as a **ceiling, not a preference**. The escape hatches that used to close these lines ("unless absolutely necessary") were the door any content rule asking for argument or substantiation walked straight through: the model satisfied the content rule by expanding, and the length limit lost every time. Now the instruction says explicitly that cutting content is the correct way to stay inside the limit.
- `short` — at most one paragraph of 2–4 sentences, no second paragraph, no bullet lists, no headings, no worked examples.
- `medium` — at most 2 short paragraphs, roughly 8 sentences, or an equally compact structured answer.
- `detailed` — substantiate fully, but do not pad, repeat or restate what has already been established.
- `null` — no constraint. `DEFAULT_RESPONSE_LENGTH = 'short'`.
- The export writes this as a `Verbosity: …` label, which `data/Session.js` undoes on import (`free` for the null case).

