# src/components/SummaryPanel.jsx

**Role** — The panel that shows the running context summary, its size, and the debug entry points.

**Notes**

- Shows the summary text (collapsible via `summaryVisible` / `onToggleVisible`) and, in debug mode, three inspection links: the summary debug output, the last prompt estimate, the last request payload, and the memory store (`onInspectMemory`).
- Memory size is computed as the UTF-8 byte length of the stored JSON, shown in B or KB — the same unit the context budget speaks in, which is why it is measured with `TextEncoder` and not `String.length`.
- `PromptEstimateBadge` sits here, in `lastPromptEstimate`: the summary panel is where the user looks to understand what a turn costs.
- `streamingRole` is used to indicate that the summary is being rewritten while a turn streams.
- All data arrives as props: the panel never reads the engine.
