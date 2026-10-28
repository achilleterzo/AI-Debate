# src/debate/PromptBuilder.js

**Role** — Assembles a participant's system prompt out of the independent blocks, in a fixed order.

**Notes**

- Each block comes from its own module, which keeps the wording of a concern next to the concern: debate mode (`prompts/DebateModePrompt`), constraints (`ConstraintsPrompt`, plus `resolveConstraint`), affinity (`AffinityPrompt`), output language (`LanguagePrompt`), delivery style (`DeliveryStyle`), moderator (`ModeratorPrompt`), tool protocol (`ToolProtocol`: structured calls, or the no-call variant, or the available-tools description), message references (`MessageReference`) and the topic (`TopicPrompt`).
- The mode is normalized first (`normalizeDebateMode`), so an unknown stored value can never remove a block silently.
- Order matters and is the reason this lives in one place: identity and policy before tools, tools before the topic. `tests/PromptBuilderPriorities.test.js` pins the arrangement.
