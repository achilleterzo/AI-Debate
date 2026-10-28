# src/components/AffinitySettings.jsx

**Role** — Three switches that shape how the table behaves: random turn order, dynamic affinity, moderation cooling.

**Notes**

- Grouped together because they are all "how the table runs" rather than "who the participants are".
- The switches are hand-built divs with local styling rather than a library control: the toggle look has to match the rest of the inline styles, and a checkbox would have looked foreign.
- The `title` on each switch explains the *state* (`randomTurnOrderTitleOn` / `…Off`) instead of naming the option again.
- `moderationCooling` is chosen from `MODERATION_COOLING_STEPS` (`settings/Settings.js`), the same values the engine uses.
- `running` disables all three — they change the procedure, so they are decided before the debate, not during it.
