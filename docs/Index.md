# Project source index

One note per source file, written from the code itself. The layout under `Docs/` mirrors `src/` and `electron/`, so a note has the same path as the file it describes.

Coverage: every file in `src/` and `electron/`, plus one page for `tests/` and one for `scripts/`. Generated output (`dist/`), dependencies and configuration files are out of scope.

## Application shell

- [src/App.jsx](src/App.md) — the shell: session state, every hook and panel wired together, localized option tables.
- [src/Main.jsx](src/Main.md) — entry point; why the emoji font is bundled.
- [src/index.css](src/index.css.md) — design tokens, font stacks, selection rules, the single/two-column breakpoint.
- [src/assets](src/assets.md) — provider logos, and why the splash and import icons are inlined instead.

## Components — `src/components/`

Layout and chrome

- [Style.jsx](src/components/Style.md) — the shared inline style objects and the `CHAT_CSS` injector.
- [HeaderTop.jsx](src/components/HeaderTop.md) — the top bar: connection state, update badge, commands.
- [TopMenu.jsx](src/components/TopMenu.md) — the dropdown menu and its outside-click handling.
- [DropdownItem.jsx](src/components/DropdownItem.md) — one menu row.
- [RemoveButton.jsx](src/components/RemoveButton.md) — the X that removes a chip or a row.
- [Dots.jsx](src/components/Dots.md) — the three blinking dots.
- [ScrollToBottomButton.jsx](src/components/ScrollToBottomButton.md) — the return-to-bottom control.
- [SplashScreen.jsx](src/components/SplashScreen.md) — the welcome screen.
- [ImportNoticeModal.jsx](src/components/ImportNoticeModal.md) — the notice after an import.

The conversation

- [ChatTimeline.jsx](src/components/ChatTimeline.md) — the transcript: balloons, tool pills, citations, conclusions.
- [UserInputBox.jsx](src/components/UserInputBox.md) — the user writing a turn as a participant.
- [AttachmentsChips.jsx](src/components/AttachmentsChips.md) — the chips of attached documents and images.
- [ImageLightbox.jsx](src/components/ImageLightbox.md) — a viewed image, full size.
- [SummaryPanel.jsx](src/components/SummaryPanel.md) — the running summary, its size, the debug entry points.
- [SummaryProgressBadge.jsx](src/components/SummaryProgressBadge.md) — "summary in progress".
- [PromptEstimateBadge.jsx](src/components/PromptEstimateBadge.md) — the estimated prompt size pill.
- [ConclusionsPanel.jsx](src/components/ConclusionsPanel.md) — choosing and generating a conclusion.

Composing and starting

- [TopicComposer.jsx](src/components/TopicComposer.md) — the composer field: topic, interjection, history, wand.
- [InputActionButtons.jsx](src/components/InputActionButtons.md) — attach, start, stop, force stop, intervene, resume.
- [RoundsInput.jsx](src/components/RoundsInput.md) — the round limit.
- [MagicWand.jsx](src/components/MagicWand.md) — the suggestion button and its popover.
- [DebateWizard.jsx](src/components/DebateWizard.md) — generating a topic and a cast.
- [DebateModeSettings.jsx](src/components/DebateModeSettings.md) — the mode picker.
- [AffinitySettings.jsx](src/components/AffinitySettings.md) — random order, dynamic affinity, moderation cooling.
- [DebateLimitsSettings.jsx](src/components/DebateLimitsSettings.md) — the debug switch.
- [GlobalConstraintsMenu.jsx](src/components/GlobalConstraintsMenu.md) — the table-wide rules.

Participants and providers

- [ParticipantsPanel.jsx](src/components/ParticipantsPanel.md) — the participant editor and the moderator settings.
- [EndpointModelGroup.jsx](src/components/EndpointModelGroup.md) — provider button and model select as one field.
- [ThinkingLevels.js](src/components/ThinkingLevels.md) — the reasoning levels as select options.
- [OllamaSettings.jsx](src/components/OllamaSettings.md) — the Ollama tab: address and model switches.
- [ProviderSettings.jsx](src/components/ProviderSettings.md) — the providers dialog.
- [ProviderSettingsDialog.jsx](src/components/ProviderSettingsDialog.md) — its dialog shell.
- [SummarySettings.jsx](src/components/SummarySettings.md) — summary options and the output language.
- [PromptSettingsModal.jsx](src/components/PromptSettingsModal.md) — the four-tab settings dialog.

Dialogs

- [AppModals.jsx](src/components/AppModals.md) — the single mount point for every dialog.
- [ConstraintModal.jsx](src/components/ConstraintModal.md) — writing a constraint or a table-wide rule.
- [ConfirmModal.jsx](src/components/ConfirmModal.md) — the generic confirmation.
- [CustomLanguageModal.jsx](src/components/CustomLanguageModal.md) — the free-text language entry.
- [PayloadModal.jsx](src/components/PayloadModal.md) — the JSON inspector.

## Data and the engine

- [data/Data.js](src/data/Data.md) — persistence, JSON and HTML export.
- [data/Session.js](src/data/Session.md) — reading an exported session back.
- [data/Storage.js](src/data/Storage.md) — the `localStorage` keys and helpers.
- [data/Document.js](src/data/Document.md) — an attached file as text.
- [debate/Debate.js](src/debate/Debate.md) — the engine: turns, order, prompts, providers.
- [debate/DebateController.js](src/debate/DebateController.md) — the hook bridging state and engine.
- [debate/PromptBuilder.js](src/debate/PromptBuilder.md) — assembling a participant's system prompt.
- [debate/ContextPayload.js](src/debate/ContextPayload.md) — how a message enters a payload: ids and citations.
- [debate/Stream.js](src/debate/Stream.md) — transport, cleaning and the tool loop.

## Hooks — `src/hooks/`

- [useAppSettings.js](src/hooks/useAppSettings.md) — every persisted setting and its defaults.
- [useAppLayout.js](src/hooks/useAppLayout.md) — layout switch, auto-follow, scroll button.
- [useAttachments.js](src/hooks/useAttachments.md) — the attached documents.
- [useConclusions.js](src/hooks/useConclusions.md) — generating conclusions.
- [useDebateWizard.js](src/hooks/useDebateWizard.md) — the wizard's state machine.
- [useEndpointStatuses.js](src/hooks/useEndpointStatuses.md) — endpoint reachability.
- [useMagicWand.js](src/hooks/useMagicWand.md) — the React side of the wand.
- [useModelCapabilities.js](src/hooks/useModelCapabilities.md) — what each model can do.
- [useSnapshots.js](src/hooks/useSnapshots.md) — saving and restoring a snapshot.
- [useSplashScreen.js](src/hooks/useSplashScreen.md) — splash visibility and its preference.
- [useTopicComposer.js](src/hooks/useTopicComposer.md) — starting, interjecting, forking.
- [useUpdateCheck.js](src/hooks/useUpdateCheck.md) — the startup update check.

## Providers — `src/providers/`

- [index.js](src/providers/index.js.md) — the registry and `getProvider`.
- [ollama.js](src/providers/ollama.md) — the reference provider.
- [ollamaCloud.js](src/providers/ollamaCloud.md) — Ollama's hosted service.
- [hosted.js](src/providers/hosted.md) — the desktop bridge and the API keys.
- [openAiCompatible.js](src/providers/openAiCompatible.md) — the OpenAI dialect as a factory.
- [openRouter.js](src/providers/openRouter.md) — OpenRouter and its catalogue.
- [gemini.js](src/providers/gemini.md) — Gemini through the OpenAI-compatible endpoint.
- [cli.js](src/providers/cli.md) — desktop CLI clients as providers.
- [codex.js](src/providers/codex.md) — the Codex client.
- [claude.js](src/providers/claude.md) — the Claude Code client.

## Tools — `src/tools/`

- [index.js](src/tools/index.js.md) — the tool lists, icons and re-exports.
- [ToolSettings.js](src/tools/ToolSettings.md) — the user-facing tool list and its switches.
- [WebSearchTool.js](src/tools/WebSearchTool.md) — `web_search`.
- [FetchUrlTool.js](src/tools/FetchUrlTool.md) — `fetch_url`.
- [ConversationTools.js](src/tools/ConversationTools.md) — `get_recent_messages`, the moderator tools, the dispatcher.
- [QuoteTool.js](src/tools/QuoteTool.md) — `quote_message` and verifiable citation.
- [MemoryTool.js](src/tools/MemoryTool.md) — `memory`.
- [AttachmentTool.js](src/tools/AttachmentTool.md) — `read_attachment`.
- [ImageTool.js](src/tools/ImageTool.md) — `view_image`.
- [DiceTool.js](src/tools/DiceTool.md) — `roll_dice`.

## Prompts — `src/prompts/`

- [Modes.js](src/prompts/Modes.md) — the debate modes.
- [DebateModePrompt.js](src/prompts/DebateModePrompt.md) — the mode's prompt block, including Role Play.
- [ConstraintsPrompt.js](src/prompts/ConstraintsPrompt.md) — the constraints block.
- [ModeratorPrompt.js](src/prompts/ModeratorPrompt.md) — the moderator's blocks and authority.
- [ToolProtocol.js](src/prompts/ToolProtocol.md) — how a model may call a tool.
- [MessageReference.js](src/prompts/MessageReference.md) — how to read and cite `[#id]` markers.
- [TopicPrompt.js](src/prompts/TopicPrompt.md) — the topic and the attachments index.
- [AffinityPrompt.js](src/prompts/AffinityPrompt.md) — the affinity weights.
- [LanguagePrompt.js](src/prompts/LanguagePrompt.md) — naming the output language.
- [DeliveryStyle.js](src/prompts/DeliveryStyle.md) — the default delivery style.
- [DefaultGeneralPersonalityInstructions.js](src/prompts/DefaultGeneralPersonalityInstructions.md) — the conflict decision order.
- [ReasoningContext.js](src/prompts/ReasoningContext.md) — context discipline versus reasoning focus.
- [ResponseLengths.js](src/prompts/ResponseLengths.md) — length as a ceiling.
- [Moods.js](src/prompts/Moods.md) — the moods.
- [MoodIntensity.js](src/prompts/MoodIntensity.md) — how strongly a mood shows.
- [EducationLevels.js](src/prompts/EducationLevels.md) — the education levels.
- [AgeGroups.js](src/prompts/AgeGroups.md) — the age groups.
- [ConclusionTypes.js](src/prompts/ConclusionTypes.md) — the conclusion kinds and their guidance.
- [PromptTags.js](src/prompts/PromptTags.md) — the prompt's own tags, and the stripper.
- [ReasoningLeak.js](src/prompts/ReasoningLeak.md) — reasoning written into the message.
- [PseudoToolCalls.js](src/prompts/PseudoToolCalls.md) — tool calls a model typed instead of emitting.

## Services — `src/services/`

- [AI.js](src/services/AI.md) — model discovery and the disabled-model filter.
- [Images.js](src/services/Images.md) — images as the models receive them.
- [Suggestions.js](src/services/Suggestions.md) — the wand's prompts and parsing.
- [Updates.js](src/services/Updates.md) — the update check.
- [Web.js](src/services/Web.md) — search, pages and caches.

## Support modules

- [settings/Settings.js](src/settings/Settings.md) — constants, defaults and normalizers.
- [styles/ChatCss.js](src/styles/ChatCss.md) — the chat's stylesheet, shared with the export.
- [utils/ChatGrouping.js](src/utils/ChatGrouping.md) — how a turn is assembled.
- [utils/Markdown.js](src/utils/Markdown.md) — the one Markdown pipeline and its allowlist.
- [utils/MessageMarkdown.js](src/utils/MessageMarkdown.md) — message rendering and its cache.
- [utils/Sorting.js](src/utils/Sorting.md) — the ordering rule for the timeline.
- [utils/Slug.js](src/utils/Slug.md) — topic to file name.
- [utils/Textarea.js](src/utils/Textarea.md) — the growing composer.

## Data tables — `src/dataset/`

- [Palette.js](src/dataset/Palette.md) — participant colours and tags.
- [CharacterTypes.js](src/dataset/CharacterTypes.md) — the character-type options.
- [RandomNames.js](src/dataset/RandomNames.md) — default participant names.

## Interface strings — `src/i18n/`

- [UiStrings.js](src/i18n/UiStrings.md) — the language list and the English base table.
- [UiStringsContext.js](src/i18n/UiStringsContext.md) — the context and the `useUiStrings` hook.
- [UiStringsProvider.jsx](src/i18n/UiStringsProvider.md) — merging a locale over the base.
- [locales/index.js](src/i18n/locales/index.js.md) — the locale registry.
- [it](src/i18n/locales/it.md) · [fr](src/i18n/locales/fr.md) · [de](src/i18n/locales/de.md) · [es](src/i18n/locales/es.md) · [pt](src/i18n/locales/pt.md) · [ja](src/i18n/locales/ja.md) · [zh](src/i18n/locales/zh.md) · [ko](src/i18n/locales/ko.md) — the translations, each a partial table merged over English.

## Desktop — `electron/`

- [main.js](electron/main.md) — window, IPC, encrypted keys, CLI clients, web bridge.
- [preload.js](electron/preload.md) — the `window.desktop` surface.
- [cliShim.js](electron/cliShim.md) — unwrapping an npm `.cmd` shim on Windows.
- [cliStream.js](electron/cliStream.md) — CLI output as the NDJSON the renderer reads.
- [web/index.js](electron/web/index.js.md) — the web layer: pages, search, images.
- [web/browserSession.js](electron/web/browserSession.md) — the hidden Chromium window and its queue.
- [web/extractPage.js](electron/web/extractPage.md) — the in-page page extractor.
- [web/urlSafety.js](electron/web/urlSafety.md) — the refusal rules for tool-supplied URLs.
- [web/image.js](electron/web/image.md) — image downloads and page screenshots.
- [web/serp.js](electron/web/serp.md) — reading a result page, in two halves.

### Search engines — `electron/web/engines/`

- [catalog.js](electron/web/engines/catalog.md) — the engine table, shared with the renderer.
- [index.js](electron/web/engines/index.js.md) — the main-process view of each engine.
- [hosts.js](electron/web/engines/hosts.md) — the two shared helpers.
- [duckduckgo.js](electron/web/engines/duckduckgo.md) — the one that works without the desktop browser.
- [brave.js](electron/web/engines/brave.md) — the simplest descriptor.
- [bing.js](electron/web/engines/bing.md) — and its click-through unwrapping.
- [qwant.js](electron/web/engines/qwant.md) — the one with a wait condition.
- [yandex.js](electron/web/engines/yandex.md) — explicit-only, `text` parameter.
- [google.js](electron/web/engines/google.md) — explicit, experimental.

## Outside the source tree

- [tests.md](tests.md) — the suite by subject, and what it protects.
- [scripts/generate-icons.md](scripts/generate-icons.md) — how the icons are produced.

