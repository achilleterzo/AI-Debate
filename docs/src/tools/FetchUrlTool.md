# src/tools/FetchUrlTool.js

**Role** — The `fetch_url` tool: its definition, and the executor that runs it.

**Notes**

- The page comes back as Markdown **with its links intact**, and that is what makes the tool iterative: an agent reads a homepage, sees a link in the text, and calls the tool again on it. A summary would have removed exactly the part that lets it do that.
- Long pages come back one block at a time: the reply states how many blocks there are and `page` (1-based) asks for the next one.
- `mode: 'markdown' | 'raw'` — clean Markdown versus the unprocessed page text, the latter for verbatim quotation.
- `executeFetchUrl` returns text in every case, failures included: a page that could not be read has to say so, or the model fills the silence with an invention. It accepts either the arguments object or a bare URL string.
- Constraints carry the imperative for the prompt builder: fetch before describing, never simulate a fetch.
- Exercises: `tests/WebPage.test.js`.
