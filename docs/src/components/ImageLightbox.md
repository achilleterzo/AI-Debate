# src/components/ImageLightbox.jsx

**Role** — What a participant looked at with `view_image`, shown full size.

**Notes**

- The message stores only the **thumbnail**: the full image lived in the turn and nowhere else. So the full picture is resolved again when the lightbox opens — from the attachments, the session's image cache (`services/Images`), or a fresh download (`loadFullImage` from `tools/ImageTool.js`) — with the thumbnail standing in until it arrives.
- `isThumbnailDataUrl` decides whether the stored image can be used as the placeholder at all.
- A failed load is handled explicitly rather than leaving a blank frame: the source can be a remote URL that has since gone.
- The source is read from `invocation.imageSource` or the call's own `arguments.source`, so old and new invocations both open.
- Opened from the chat when a `view_image` pill is clicked (`ChatTimeline`).
