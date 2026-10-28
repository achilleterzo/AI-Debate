# src/tools/ToolSettings.js

**Role** — The user-facing list of tools and their on/off state.

**Notes**

- One entry per tool: `id`, `icon`, `labelKey`, and two flags — `moderatorOnly` (`apply_moderation`) and `rolePlayOnly` (`roll_dice`). The flags are what the settings UI uses to show a tool only where it applies.
- `labelKey` is a key into the i18n strings, not a label: the tool's name is translated like everything else.
- `DEFAULT_ENABLED_TOOLS` turns everything on, and `normalizeEnabledTools` reads a stored map with `!== false`, so a tool added in a later version is enabled by default for existing users instead of silently missing.
- Exercises: `tests/Debate.test.js` (enabled-tool filtering).
