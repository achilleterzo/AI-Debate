# src/utils/Textarea.js

**Role** — Grows a textarea to fit its content, up to its own CSS `max-height`.

**Notes**

- The height is cleared first, so the measurement shrinks as well as grows. Without that, `scrollHeight` never reports less than the height already set, and the field would keep every line it ever reached.
- The ceiling is left to CSS: the browser clamps the height it is given, so the cap lives with the rest of the styling instead of being repeated in this function.
- Requires `box-sizing: border-box`, which `index.css` sets globally: `scrollHeight` includes the padding, so under `content-box` the field would gain its own padding on every call.
