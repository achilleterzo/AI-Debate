# src/hooks/useModelCapabilities.js

**Role** — What each participant's model can do, as the endpoint reports it.

**Notes**

- The settings panel offers controls only some models accept, and asking a model without the capability to *think* is an HTTP 400 and a lost turn. So the control has to know before the user reaches for it, not after.
- Answers are cached inside the provider, and the hook memoizes per model, so opening the panel repeatedly does not re-query the endpoint.
- Used to enable or hide thinking-level controls and similar per-model options; the capability map is keyed by participant id.
