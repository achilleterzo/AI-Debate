# src/providers/openRouter.js

**Role** — OpenRouter: one key, one API, hundreds of hosted models.

**Notes**

- The catalogue is also the capability table: it says which input modalities each model accepts and which parameters it supports, so listing models for the pickers answers, for free, what each one can do. `modelCapabilities` reads `architecture.input_modalities` and `supported_parameters` and returns the app's own vocabulary (`tools`, `thinking`, `vision`).
- The catalogue is kept in memory for the session: it is a single request, and a debate asks about a model on every turn.
- An id that is not in the catalogue — a model withdrawn, or a listing that never happened — is *assumed capable* (`['tools', 'thinking']`): the alternative is refusing to run a model that may be fine.
- `reasoningField: 'reasoning'` (nested `{ reasoning: { effort } }`), and the usage report is asked for in the final chunk.
