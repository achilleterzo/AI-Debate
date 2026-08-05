// Prompt text is kept in top-level templates so it can be reviewed and edited
// without reading through the selection logic at the bottom of the file.

const SHARED_MODE_BLOCK = mode => `NON-NEGOTIABLE SHARED DEBATE MODE — ${mode.labelEn.toUpperCase()}:
This is the highest-priority user-configured behavioral rule in this prompt. It applies to every participant and every turn. System/developer rules and binding moderator process directives still take precedence, but this mode outranks mood, personality, affinity, character style, and ordinary participant constraints. You MUST make your contribution serve this mode; do not merely mention the mode or answer as if the debate were in Free mode.

Operational rule: ${mode.instruction}

Before sending each response, silently verify that the response visibly performs the operational rule above. If another instruction conflicts with this mode, preserve the mode and adapt the tone or framing instead.`

const FREE_MODE_BLOCK = `SHARED DEBATE MODE — FREE:
No specialized debate procedure is active. Respond naturally to the topic while following the other applicable rules.`

const ROLE_PLAY_MASTER_BLOCK = `ROLE PLAY ROLE — MASTER / NARRATOR:
You are also the Master / Narrator. Control the fictional world, adjudicate actions and consequences, narrate scenes, and keep the story moving. When a ruling depends on chance, invoke roll_dice for the specific action being resolved. The invocation belongs only to the participant who calls the tool; share the resulting numbers and apply them authoritatively to everyone. Do not behave only as a procedural moderator.`

const ROLE_PLAY_PARTICIPANT_BLOCK = `ROLE PLAY ROLE — SHARED FICTION:
The moderator is also the Master / Narrator. Treat the moderator's narration and adjudication as the authority on the fictional world. Stay in character, make meaningful choices, and invoke roll_dice only for your own action when a random outcome is needed. The invocation belongs to you; only its result is shared with every participant. Do not claim the group rolled, do not retract a valid roll, and do not reroll an already shared result.`

const ROLE_PLAY_PARTICIPATION_RULE = `Role Play participation rule: Do not debate, fact-check, critique, negotiate, or meta-comment on the Master's narration. Accept it as scene input and respond actively inside the fiction with a concrete choice or attempted action.`

export function buildDebateModePromptBlocks({ mode, isModerator }) {
  const isRolePlay = mode.id === 'role_play'

  const modeBlock = mode.instruction ? SHARED_MODE_BLOCK(mode) : FREE_MODE_BLOCK

  const rolePlayBlock = !isRolePlay
    ? ''
    : isModerator ? ROLE_PLAY_MASTER_BLOCK : ROLE_PLAY_PARTICIPANT_BLOCK

  const rolePlayParticipantRule = isRolePlay && !isModerator ? ROLE_PLAY_PARTICIPATION_RULE : ''

  return { modeBlock, rolePlayBlock, rolePlayParticipantRule }
}
