# src/components/EndpointModelGroup.jsx

**Role** — The provider button and the model select joined into one input group, for a single participant.

**Notes**

- The provider button is the *left cap of the select*, not a control of its own: one field, two halves. That is why it is a bespoke component rather than a select with an icon.
- The provider icon (`PROVIDER_ICONS`, using the SVGs in `assets/provider-logos/`) opens the shared connection/settings dialog scoped to this participant, so choosing a provider and configuring it are the same gesture.
- A custom local endpoint keeps its reachability badge: `ENDPOINT_STATE_COLORS` maps `ok` → green, `err` → red, `checking` → amber. The statuses come from `hooks/useEndpointStatuses.js`.
- The model list is filtered through `AI.keepEnabledModels`, so a model disabled in the Ollama tab cannot be chosen here either.
- A provider left unset means "inherit the general provider and default model"; that inheritance is what lets a single table mix local and hosted participants.
