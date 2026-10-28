# src/providers/claude.js

**Role** — The Claude Code CLI client as a provider: `createCliProvider({ id: 'claude', label: 'Claude' })`.

**Notes**

- A single line of configuration over the shared factory in `src/providers/cli.js`; the behaviour (flattened transcript, text tool protocol, bridge transport) is documented there.
- Do not confuse it with the Claude HTTP API: this file talks to the locally installed client, authenticated by the client itself.
