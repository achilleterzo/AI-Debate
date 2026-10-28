# src/providers/codex.js

**Role** — The Codex CLI client as a provider. Four lines: it is `createCliProvider({ id: 'codex', label: 'Codex' })` and nothing else.

**Notes**

- Everything it does — the flattened transcript, the text tool protocol, the bridge transport, the Ollama NDJSON stream — is described in `src/providers/cli.md`.
- Being this small is the point: adding another CLI client is one file of the same shape, plus a line in the registry (`src/providers/index.md`).
