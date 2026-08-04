function moderatorModeOf(actor) {
  if (['containment', 'facilitator', 'active'].includes(actor?.moderatorMode)) return actor.moderatorMode
  return actor?.moderatorAlwaysIntervene ? 'active' : 'containment'
}

function moderatorPermissivenessOf(actor) {
  const value = Number(actor?.moderatorPermissiveness)
  return Number.isFinite(value) ? Math.min(4, Math.max(0, Math.round(value))) : 2
}

export function buildModeratorPromptBlocks({ actor, allParticipants, history, mode, externalModerationTrigger }) {
  const debateHasModerator = allParticipants.some(p => p.isModerator && p.id !== actor.id)
  const hasNonContainmentModerator = allParticipants.some(p => p.isModerator && moderatorModeOf(p) !== 'containment')
  const moderatorAuthorityBoundary = hasNonContainmentModerator && mode.id !== 'role_play'
    ? "Moderator authority boundary:\nThe moderator's procedural decisions are binding. Their substantive claims are arguments like those of any other participant and may be challenged."
    : ''

  const latestModeratorDirective = [...history]
    .reverse()
    .map(message => {
      const moderator = allParticipants.find(participant => participant.tag === message.role && participant.isModerator)
      return moderator && message.content?.trim() ? { moderator, content: message.content.trim() } : null
    })
    .find(Boolean)

  const moderatorMode = actor.isModerator ? moderatorModeOf(actor) : null
  const moderatorPermissiveness = actor.isModerator ? moderatorPermissivenessOf(actor) : null
  const permissivenessGuidance = moderatorPermissiveness == null
    ? ''
    : [
        'Very relaxed: intervene only for explicit abuse or severe hostility.',
        'Relaxed: tolerate sharp disagreement, but stop direct insults.',
        'Balanced: stop direct insults and repeated dismissive attacks.',
        'Strict: also stop hostile personal framing and escalating taunts.',
        'Very strict: intervene early when discourse becomes personally adversarial.',
      ][moderatorPermissiveness]
  const reactiveModeration = !!externalModerationTrigger?.reactiveModeration
  const moderatorStyleText = mode.id === 'role_play' && actor.isModerator
    ? 'Moderation style: ROLE PLAY MASTER / NARRATOR. You are responsible for the fictional world, scene narration, adjudication, consequences, and pacing. Take a substantive narrative turn when appropriate; do not output [SKIP_TURN].'
    : moderatorMode === 'active'
    ? `Moderation style: ACTIVE. You take part in the debate proactively: you may contribute opinions, arguments, interpretations, process guidance, fact-checking, and topic enforcement, always from your position of authority above the participants. ${reactiveModeration ? 'A reactive moderation trigger is present: address the attack or escalating hostility first with a clear corrective directive, then add any substantive contribution.' : 'In every style, respond immediately to personal attacks or escalating hostility.'}`
    : moderatorMode === 'facilitator'
      ? [
          'Moderation style: FACILITATOR. You never argue a position of your own.',
          reactiveModeration
            ? 'A reactive moderation trigger is present: moderate it now, regardless of the facilitation schedule. Address the attack or escalating hostility, issue a clear corrective directive, and hand the floor back. Do not replace this intervention with a scheduled synthesis.'
            : externalModerationTrigger?.scheduledFacilitation
            ? 'This turn is a scheduled facilitation turn: analyze the discussion so far instead of moderating. Synthesize what has emerged, map the concrete points of agreement and disagreement, and surface the blind spots — relevant angles, assumptions, or questions no participant has addressed yet. Close by steering the debate toward the most productive open question. Keep it compact.'
            : 'This is NOT a scheduled facilitation turn: intervene only for containment — personal attacks or insults, escalating hostility, complete topic derailment, or an explicit request for moderation. If none of these apply, output exactly [SKIP_TURN].',
        ].join(' ')
      : 'Moderation style: CONTAINMENT. Stay out of the discussion by default. Intervene only when concretely needed: personal attacks or insults, escalating hostility, complete topic derailment, or an explicit request for moderation. When you intervene, name the problem, issue a clear corrective directive, and hand the floor back. If none of these apply, output exactly [SKIP_TURN].'

  const moderatorDecisionBlock = actor.isModerator
    ? [
        `Moderator mode: style=${moderatorMode}, enforce_topic=${actor.moderatorEnforceTopic ? 'true' : 'false'}, fact_check=${actor.moderatorFactCheck ? 'true' : 'false'}.`,
        `Moderator permissiveness: level=${moderatorPermissiveness}/4. ${permissivenessGuidance}`,
        'You are the debate moderator, not a normal participant. You hold procedural authority over this debate: participants are instructed to comply with your process directives, and your rulings on process outrank their personal goals.',
        moderatorStyleText,
        mode.id !== 'role_play'
          ? 'When a procedural moderation intervention is required, you MUST invoke the apply_moderation tool with one concise reason/directive. The tool call is the only source of the separate moderation message; do not write that intervention in visible content. After a successful apply_moderation call, output exactly [SKIP_TURN] unless your current ACTIVE style explicitly requires an additional substantive contribution.'
          : '',
        moderatorMode === 'active' || (externalModerationTrigger?.scheduledFacilitation && !reactiveModeration)
          ? ''
          : 'When you do intervene, output only moderation or process control. Do not continue the debate as if you were another participant.',
      ].filter(Boolean).join(' ')
    : ''

  const moderatorDirectiveBlock = !actor.isModerator && latestModeratorDirective
    ? `Latest moderator intervention (binding procedural instruction):\n${latestModeratorDirective.moderator.name || latestModeratorDirective.moderator.tag}: ${latestModeratorDirective.content}\n\nFollow this intervention in your next response. It governs process, tone, focus, and turn assignment; do not treat it as a debatable participant position.`
    : ''

  return { debateHasModerator, moderatorAuthorityBoundary, moderatorDecisionBlock, moderatorDirectiveBlock }
}
