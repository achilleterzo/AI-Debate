# src/components/RoundsInput.jsx

**Role** — The round limit, as a single control next to the topic bar.

**Notes**

- The label and the number share one bordered box, so it reads as one field rather than a loose label plus input. The box matches the composer height (`height: 44`) so the row lines up.
- `0` means infinite rounds, and the tooltip says so (`0 = ∞`) — that is the only place the convention is explained, so it must stay.
- `running` fades the control and blocks editing: the limit belongs to the session.
- The value is clamped when it is applied (in `App`), not here — this component only reports what was typed.
