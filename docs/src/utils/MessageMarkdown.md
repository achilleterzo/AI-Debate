# src/utils/MessageMarkdown.js

**Role** — The path a message takes on its way to HTML, in the chat and in the export alike: same Markdown options, same shorthand clean-up, same result.

**Notes**

- `normalizeMathShorthands` turns `$\rightarrow$` and friends into the arrow characters — small, but the reason a model's arrows no longer arrive as raw TeX.
- The safety rules are not here: they live in `utils/Markdown.js`, the only configured parser.
- `renderMessageMarkdown` caches the HTML by message text. During a stream the chat re-renders on every chunk and asks for the Markdown of *every* message, so parsing them all again each time makes the cost of a token grow with the length of the debate — which is what saturated the renderer on long runs. Message text never changes once written, so the result can be remembered; only the streaming message is a genuine miss.
- The cache is bounded (`MARKDOWN_CACHE_LIMIT = 400`) with least-recently-used eviction: a streaming message mints a new entry per chunk, and without the cap those partials would accumulate for the whole run.
- Exercises: `tests/Markdown.test.js`.
