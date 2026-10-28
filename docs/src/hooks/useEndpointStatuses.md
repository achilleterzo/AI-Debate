# src/hooks/useEndpointStatuses.js

**Role** — Reachability of every custom endpoint used in the session, participant endpoints and the summary endpoint alike.

**Notes**

- `SUMMARY_ENDPOINT_ID = 'summary'` is the key for the summary endpoint in the status map. It is a string because participant ids are numbers, so the two can never collide.
- `NO_EXTRA_ENDPOINTS` is a module-level empty array for the stable default: a literal `[]` default would make the memos downstream see a new array on every render.
- Polls through the same `getProvider(...)` abstraction as everything else, so an endpoint is checked the way it will be used.
- Result is a map id → status, consumed by the participant list to draw the dot next to each endpoint.
