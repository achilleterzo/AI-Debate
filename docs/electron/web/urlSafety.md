# electron/web/urlSafety.js

**Role** — Guards a tool-supplied URL before the desktop browser navigates to it.

**Notes**

- A model can put any URL into `fetch_url` or `view_image`, which makes it attacker-influenced input — and the desktop browser sits inside the user's own network. So the check is a deny list of what must never be reached.
- `privateIPv4` rejects loopback, private ranges, carrier-grade NAT (`100.64/10`), link-local `169.254`, benchmarking `198.18/19`, `0.0.0.0` and everything `>= 224` (multicast and reserved), and treats any malformed address as private.
- `privateIp` adds the IPv6 forms: `::`, `::1`, `fc`/`fd` (unique local), `fe8`/`fe9`/`fea`/`feb` (link-local), and anything that is not an IP at all.
- The default is refusal: an address that cannot be parsed is treated as private.
- `assertPublicHttpUrl` resolves the host through `node:dns/promises` and validates the **resolved** address, not only the literal — otherwise a hostname pointing at `127.0.0.1` would walk straight through.
- Exercises: `tests/WebPage.test.js`.
