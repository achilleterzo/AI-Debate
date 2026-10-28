# src/prompts/PseudoToolCalls.js

**Role** — Detects and strips tool calls a model *typed* instead of emitting through the structured interface.

**Notes**

- The markup comes from the model's training data, not from this app, and arrives in whatever combination the model remembers: a closer with no opener, an opener still streaming, nested blocks, the compact call form some models prefer, or no markup at all — just the arguments alone on a line. None of it ran: a tool is invoked only through the structured interface, so every one of these is a call the user is shown and nobody made.
- Removing them matters twice. In the chat they are noise. In the payload they are worse: a transcript that keeps them teaches the syntax to everyone who reads it, and a table where one model types a fake dice call soon becomes a table where they all do.
- `TOOL_ARGUMENT_SHAPES` is a copy of the tools' argument schemas, written out here rather than imported. `src/tools` already imports this module's neighbours, so importing back would close a cycle and leave the table empty at import time — `tests/PseudoToolCalls.test.js` asserts the copy still matches the real schemas, which is what makes the duplication safe.
- The shape table is what catches a call that is only arguments, with no name left to recognise: `matchesShape` rejects an empty object (a bare call that is legitimate), while a call by name is still recognised through the known tool names.
- Exercises: `tests/PseudoToolCalls.test.js`.
