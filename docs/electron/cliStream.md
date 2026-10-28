# electron/cliStream.js

**Role** — Translates what the Claude and Codex clients print into the NDJSON chat stream the renderer already parses for Ollama.

**Notes**

- The target shapes are `{ message: { content } }`, `{ message: { thinking } }`, `{ done: true }` and `{ error }` lines. Because the output is Ollama-shaped, the renderer needs no CLI-specific code: `providers/cli.js` uses Ollama's stream parser unchanged.
- Kept apart from `main.js` and **free of Electron imports** so the translation — the part that decides what a user sees streaming into a balloon — can be tested without spawning a client (`tests/CliStream.test.js`).
- Effort mapping is asymmetric, and deliberately: Claude has no "off" through the CLI, so `none` asks for the least effort it accepts (`low`); Codex *lists* what each model supports, so the level is moved to the nearest one the model offers (`CODEX_PREFERENCES`) instead of being sent as a value it would reject.
- `ndjson(value)` is the one-line serializer used by everything that writes to the stream.
- `createClaudeTranslator` / `createCodexTranslator` hold the per-client state of a single stream.
