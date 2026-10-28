# src/components/Dots.jsx

**Role** — The three blinking dots shown while someone is writing.

**Notes**

- Three spans with the shared `blink` animation, each delayed by `0.2s`, which is what produces the wave.
- Exported as `DotsView` and mounted once by `App`; the timeline decides when to show it.
- Kept trivial on purpose: this renders on every streamed chunk, so it carries no state and no strings.

