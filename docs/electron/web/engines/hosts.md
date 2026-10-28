# electron/web/engines/hosts.js

**Role** — Two helpers every engine descriptor uses.

**Notes**

- `hostWithin(host, domain)` is true for the domain itself and any subdomain, and compares lowercased. It is deliberately not a substring test: `notqwant.com` must not pass for `qwant.com`.
- `redirectTarget(url, param)` returns the target hidden in a redirect URL's parameter, but only when it is an `http(s)` URL — so a `javascript:` or relative target in `?uddg=` or `?q=` is discarded instead of being followed.
- Small on purpose: the descriptor files stay data, and the two rules that need care are written once.
