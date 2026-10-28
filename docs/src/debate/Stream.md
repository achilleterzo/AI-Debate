# src/debate/Stream.js

**Role** — The transport layer of a turn: streams a chat completion from a provider, cleans the text on the way in, and drives the tool loop.

**Notes**

- Cleaning happens here, once, for every provider: prompt scaffolding is stripped (`prompts/PromptTags`), leaked reasoning is extracted and removed (`prompts/ReasoningLeak`), pseudo tool calls are extracted and removed (`prompts/PseudoToolCalls`).
- Runs the tool rounds: when the model asks for a tool, `executeFetchUrl` and the tools in `src/tools/` are called and the result is fed back, until the rounds are exhausted or the model answers.
- The two recovery nudges are deliberate and different. One is sent when the turn has no tool rounds left or the model answered with silence: withdrawing the tools from the request is not a message the model can read, a sentence is. The other (`REASONING_O…`, the reasoning-only nudge) is sent when the whole answer was deliberation: the plain nudge asks for an answer the model believes it already gave, so naming what happened is what makes the second attempt different.
- Exports `StreamAbortedError` and `abortActiveStreams`, which is how a stop request reaches every in-flight request.
