# src/services/Images.js

**Role** — Images in the form vision models accept: base64, in a format every backend decodes, and no larger than the models look at.

**Notes**

- `IMAGE_MAX_EDGE = 1568`: vision encoders downscale anything bigger themselves, so a 4000px photo would cost megabytes of request body — on every tool round of the turn — for detail the model never sees. The browser decodes whatever it can display (WebP, AVIF, GIF, SVG, BMP…) and re-encodes to PNG or JPEG (`JPEG_QUALITY = 0.88`), the two formats every vision backend accepts.
- A PNG (screenshot, diagram) is kept as PNG unless it exceeds `PNG_MAX_BYTES = 1_500_000`, then it becomes JPEG anyway.
- `IMAGE_EXTENSIONS` is the single list of what counts as an image; `isImageFileName` and `isThumbnailDataUrl` are used by `data/Document`, `data/Data` and the chat.
- Keeps a cache of images downloaded and normalized during a debate, keyed by URL, so several participants looking at the same picture download it once.
- `THUMBNAIL_EDGE` is the small size used for chips and exports.
