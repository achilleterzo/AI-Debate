# electron/web/engines/yandex.md

**Role** — The Yandex descriptor. Explicit-only: SmartCaptcha is quick to trigger on automated clients.

**Notes**

- The query parameter is `text`, not `q` — the one place where a copy-pasted `?q=` would silently return a generic page.
- `YANDEX_DOMAINS` lists the regional domains (`yandex.com`, `.ru`, `.net`, `ya.ru`, `.com.tr`, `.kz`, `.by`), used for both unwrapping and ownership.
- Organic links are direct today; the unwrap exists for older layouts that went through `/clck/jsredir?url=`, and is a no-op when the parameter is absent.
- Snippet selectors include the current `OrganicTextContentSpan` and two older wrappers, with `p` as the last resort.
- `challenge` covers `showcaptcha`, `smartcaptcha`, the English "are you not a robot" and the Russian "вы не робот" — the two languages Yandex actually answers in.
