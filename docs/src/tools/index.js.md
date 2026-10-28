# src/tools/index.js

**Role** — The tool registry: the definition lists the prompts and the stream loop are handed, plus the icons the chat draws and the re-exports the rest of the app uses.

**Notes**

- `LLM_TOOLS` — `web_search`, `fetch_url`, `read_attachment`, `view_image`, `get_recent_messages`, `quote_message`, `request_moderator_intervention`, `memory`.
- `ROLE_PLAY_TOOLS` — the same plus `roll_dice`, because a die belongs to make-believe, not to a debate.
- `MODERATOR_TOOLS` — `apply_moderation` alone, given only to the moderator.
- The two `*_WITHOUT_MODERATOR_INTERVENTION` lists are precomputed: when the moderator is handling the table, participants are not offered the request that asks for the moderator.
- `TOOL_ICONS` maps each tool name to the emoji the chat and the HTML export use — one table, so the two cannot drift.
- Re-exports the executors and helpers (`executeFetchUrl`, `readAttachment`, `viewImage`, `rollDice`, `readMemory`, `buildQuote`, …) so callers have a single import point.
