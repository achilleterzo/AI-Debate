export function buildConstraintsBlock({ actor, allParticipants, globalConstraints, generalPersonalityInstructions }) {
  const participantConstraints = (actor.constraints || [])
    .map(entry => typeof entry === 'string' ? { text: entry, override: false } : { text: String(entry?.text ?? ''), override: !!entry?.override })
    .filter(entry => entry.text.trim())
  const overrideConstraints = participantConstraints.filter(entry => entry.override)
  const personalConstraints = participantConstraints.filter(entry => !entry.override)
  const debateHasModerator = allParticipants.some(p => p.isModerator && p.id !== actor.id)

  const baselineRules = [
    'Tool-call protocol (strict): the current request payload and its tools array are the source of truth for available tools and their argument schemas. Invoke a tool only through the structured function-calling interface defined there, using valid JSON arguments; never write a tool name, pseudo-call, Markdown code, or notation such as `roll_dice`(1d20) in visible content. If a tool is not present in the payload, do not invent or simulate it.',
    'A tool instruction and a tool invocation are different events: a moderator message may instruct a participant to use a tool, but that message is not itself a tool call. The addressed participant must make their own structured call when the instruction applies; do not reproduce the command in prose, and do not call a tool on behalf of another participant.',
    ...(!actor.isModerator && debateHasModerator
      ? [
          '- A moderator holds procedural authority over this debate. If the moderator issues a process directive (de-escalation, topic redirection, turn assignment, format), comply with it in your next turn. You may keep defending your positions on content, but never ignore or overrule a moderator process directive.',
          '- Treat a moderator intervention as a binding procedural instruction, not as an ordinary peer argument. Do not debate, dismiss, reinterpret, or sidestep its directive; acknowledge it through your next response and follow its requested format or focus.',
          '- If the moderator explicitly instructs you to use a tool, follow that procedural instruction by making the structured tool call yourself when its conditions apply; do not merely describe it, quote its syntax, or claim that another participant used it. If the requested result is already present as a shared tool result, use that result and do not invoke the tool again.',
        ]
      : []),
    '- Avoid referring to other participants unless it is strictly necessary for the argument you are making.',
    '- Distinguish clearly between observed facts and your inferences. If a point is not directly supported by the topic, cited material, or the discussion itself, present it only as a tentative hypothesis or avoid it.',
    '- Do not attribute internal motives, traffic strategy, business incentives, hidden intent, or undocumented decision-making to the subject unless such claims are explicitly supported by available evidence.',
    '- If you need up-to-date external information, you may use the available web search capability. Do not claim that you cannot browse, search the web, or verify information unless a tool call has actually failed or no relevant result is available.',
    '- If the available context does not contain exchanges you need, use get_recent_messages with a small limit; you may filter it by participantTags and searchTerm when reviewing specific participants or claims.',
    '- Tool ownership is individual: a tool action is performed only by the participant who invokes it. A result may be shared with the table without making the action collective. Preserve the recorded owner and do not falsely claim, disclaim, or repeat another participant\'s tool action.',
    '- Use the memory tool for durable context that may matter in later turns. Memory writes belong to you as author; when reading, omit participantTags for all memory or provide one or more author tags for a filtered list. Do not treat memory as a substitute for the current conversation.',
    '- If you need a direct procedural intervention from the moderator, use request_moderator_intervention instead of merely asking in prose; it schedules one extra moderator turn outside the standard round.',
    '- If you think moderator intervention is needed, ask for it naturally in plain language. Do not use coded markers or special trigger syntax.',
    '- Treat the active topic as the primary obligation. Source material, cited links, and examples are supporting context only.',
    '- If the active topic asks for an opinion on a project, site, person, or initiative as a whole, do not pivot into discussing individual articles, games, side examples, or analogies unless you explicitly connect them back to that overall evaluation.',
    '- If another participant fixates on a side detail, do not follow them there by default. Pull the discussion back to the active topic.',
  ]

  return [
    generalPersonalityInstructions?.trim(),
    'Precedence between the rule sections below, from strongest to weakest: 1) the non-negotiable shared debate mode above, 2) character override constraints, 3) global rules, 4) your personal constraints, 5) general debate conduct. System/developer rules and binding moderator process directives remain higher than all of these. When two rules conflict, preserve the stronger section and adapt the weaker one.',
    overrideConstraints.length > 0
      ? `Character override constraints (highest priority — when they conflict with ANY other rule in this prompt, including global rules, these win):\n${overrideConstraints.map(entry => `- ${entry.text}`).join('\n')}`
      : '',
    (globalConstraints || []).length > 0
      ? `Global rules (they apply to every participant and take precedence over your personal constraints):\n${(globalConstraints || []).map(text => `- ${text}`).join('\n')}`
      : '',
    personalConstraints.length > 0
      ? `Your personal constraints:\n${personalConstraints.map(entry => `- ${entry.text}`).join('\n')}`
      : '',
    `General debate conduct:\n${baselineRules.join('\n')}`,
  ].filter(Boolean).join('\n\n')
}
