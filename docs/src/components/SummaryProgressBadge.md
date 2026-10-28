# src/components/SummaryProgressBadge.jsx

**Role** — The pill that says the context summary is being written.

**Notes**

- A separate component rather than a flag inside the timeline, because it appears in place of a message and must not disturb the list of balloons.
- The spinner is the same SVG as the wand's, rotated by the shared `spin` animation, so busy states look alike across the app.
- Styled in blue (`#4a9eff`) as a "work in progress" note, distinct from the red scroll button and the participant colours.
- Purely presentational: `App` decides when it is shown, from `setSummaryInProgress`.
