# Tests

The test suite is Vitest over the parts of the app that can be exercised without a browser or an LLM: prompt construction, parsing and cleaning, tool contracts, the data and export layer, the provider transports, and the search-page readers.

## Where tests live

All files are in `tests/`, named after the subject they exercise rather than always after one module (`ProviderOllama.test.js`, `PromptBuilderPriorities.test.js`, `StreamEmptyRetry.test.js`). `tests/fixtures/serp/` holds the saved result pages the search-engine readers are run against.

There are 44 test files. They are grouped below by subject, not by folder, because a single test often covers several modules — `RoundOrder.test.js` exercises `Debate` through its ordering helpers, `WebPage.test.js` covers both `services/Web` and the Electron page/safety layer.

## What the suite protects

- **Prompt construction** — `PromptBuilderPriorities`, `ContextBudget`, `ContextCap`, `ContextPayload`, `Modes`, `ModeratorModes`, `Moods`, `ThinkingLevel`, `PseudoToolCalls`, `PromptTags`. These pin the ordering and the block rules that are easy to break silently.
- **Cleaning and parsing** — `Markdown`, `PseudoToolCalls`, `QuoteTool`, `SerpReader`, `WebPage`: the layers that turn model or page output into something the app can trust.
- **Tools** — `AttachmentTool`, `ImageTool`, `ConversationTools`, `QuoteTool`, `WebSearchTool`.
- **Engine and session data** — `Debate`, `RoundOrder`, `Session`, `Settings`, `Slug`, `Sorting`.
- **Export and import** — `Export`, `ImportExportedSession`, `Conclusions`, `ConclusionContext`, `ConclusionGuidance`, `ConclusionLabels`.
- **Preferences and notices** — `NoticePreferences`, `SplashPreference`.
- **Providers and streaming** — `ProviderOllama`, `ProviderOllamaCloud`, `ProviderCli`, `CliStream`, `CliShim`, `AIModels`, `StreamEmptyRetry`, `StreamForceStop`, `Updates`.
- **Wizard and suggestions** — `WizardTopic`, `Suggestions`.

## Notes

- `StreamEmptyRetry.test.js` and `Suggestions.test.js` are the two largest files: retry behaviour and the forgiving parsing of generated text are where the corner cases accumulate.
- A copy of a schema in `src/prompts/PseudoToolCalls.js` is checked here against the real tool definitions — that duplication is only safe because a test compares the two.
- The `SerpReader` fixtures are the reason adding an engine is cheap: one descriptor, one fixture.

