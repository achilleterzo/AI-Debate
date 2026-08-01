import { DEBATE_MODES, DEFAULT_DEBATE_MODE, normalizeDebateMode } from '../prompts/Modes'

function constraintText(entry) {
  return typeof entry === 'string' ? entry : String(entry?.text ?? '')
}

function moderatorModeOf(actor) {
  if (['containment', 'facilitator', 'active'].includes(actor?.moderatorMode)) return actor.moderatorMode
  return actor?.moderatorAlwaysIntervene ? 'active' : 'containment'
}

function moderatorPermissivenessOf(actor) {
  const value = Number(actor?.moderatorPermissiveness)
  return Number.isFinite(value) ? Math.min(4, Math.max(0, Math.round(value))) : 2
}

function detectReasoningLangFromConstraints(constraints, languages) {
  const text = (constraints || []).map(constraintText).filter(Boolean).join(' ').toLowerCase()
  if (!text) return ''
  const match = languages.find(language => text.includes(language.label.toLowerCase()))
  return match?.code ?? ''
}

export function buildSystemPrompt({ actor, allParticipants, history, externalModerationTrigger = null, characterContext = null, uiLang = 'en', attachedDocs = [], globalConstraints = [], generalPersonalityInstructions = '', debateMode = DEFAULT_DEBATE_MODE, constants }) {
  const {
    MOODS,
    DEFAULT_MOOD,
    MOOD_INTENSITY,
    DEFAULT_MOOD_INTENSITY,
    CHARACTER_TYPES,
    RESPONSE_LENGTHS,
    EDUCATION_LEVELS,
    AGE_GROUPS,
    DEFAULT_AGE_GROUP,
    LANGUAGES,
    REASONING_LANG_FROM_CONSTRAINT,
  } = constants

  const mood = MOODS.find(m => m.id === actor.mood) ?? MOODS.find(m => m.id === DEFAULT_MOOD)
  const mode = DEBATE_MODES.find(entry => entry.id === normalizeDebateMode(debateMode)) ?? DEBATE_MODES[0]
  const modeBlock = mode.instruction
    ? `NON-NEGOTIABLE SHARED DEBATE MODE — ${mode.labelEn.toUpperCase()}:
This is the highest-priority user-configured behavioral rule in this prompt. It applies to every participant and every turn. System/developer rules and binding moderator process directives still take precedence, but this mode outranks mood, personality, affinity, character style, and ordinary participant constraints. You MUST make your contribution serve this mode; do not merely mention the mode or answer as if the debate were in Free mode.

Operational rule: ${mode.instruction}

Before sending each response, silently verify that the response visibly performs the operational rule above. If another instruction conflicts with this mode, preserve the mode and adapt the tone or framing instead.`
    : `SHARED DEBATE MODE — FREE:
No specialized debate procedure is active. Respond naturally to the topic while following the other applicable rules.`
  const moodIntensity = MOOD_INTENSITY[actor.moodIntensity ?? DEFAULT_MOOD_INTENSITY]
  const characterType = CHARACTER_TYPES.find(c => c.value === actor.characterType)
  const responseLength = RESPONSE_LENGTHS.find(r => r.value === actor.responseLength)
  const educationLevel = EDUCATION_LEVELS.find(e => e.value === actor.educationLevel)
  const ageGroup = AGE_GROUPS[actor.ageGroup ?? DEFAULT_AGE_GROUP]
  const languageLabel = LANGUAGES.find(l => l.code === uiLang)?.label ?? uiLang
  const requestedReasoningLang = actor.reasoningLang === REASONING_LANG_FROM_CONSTRAINT
    ? detectReasoningLangFromConstraints([...(actor.constraints || []), ...(globalConstraints || [])], LANGUAGES)
    : actor.reasoningLang
  const reasoningLangCode = requestedReasoningLang && requestedReasoningLang !== uiLang ? requestedReasoningLang : ''
  const reasoningLangLabel = reasoningLangCode ? (LANGUAGES.find(l => l.code === reasoningLangCode)?.label ?? reasoningLangCode) : ''
  const skipTranslation = !!(reasoningLangCode && actor.reasoningLangSkipTranslation)

  const roster = allParticipants
    .filter(p => p.id !== actor.id)
    .map(p => `- ${p.name || p.tag}${p.isModerator ? ' (moderator)' : ''}`)
    .join('\n')

  const affinityEntries = Object.entries(actor.affinity && typeof actor.affinity === 'object' ? actor.affinity : {})
    .map(([id, weight]) => {
      const other = allParticipants.find(p => String(p.id) === String(id) && p.id !== actor.id)
      const value = Number(weight)
      if (!other || !Number.isFinite(value) || value === 0) return null
      return `- ${other.name || other.tag}: ${value > 0 ? '+' : ''}${value.toFixed(2)}`
    })
    .filter(Boolean)

  const affinityBlock = affinityEntries.length > 0
    ? `Your relational affinity toward other participants, from -1.00 (strong conflict, distrust, hostility) to +1.00 (strong alignment, trust, support):\n${affinityEntries.join('\n')}\n\nLet these weights shape your tone toward each participant and how willing you are to agree with, build on, or push back against their arguments.`
    : ''

  const topicDirectives = history
    .filter(m => (m.role === 'topic' || m.role === 'interjection') && m.content?.trim())
    .map((m, index) => {
      if (m.role === 'topic') return `${index + 1}. Topic baseline: ${m.content.trim()}`
      return `${index + 1}. Topic update / clarification: ${m.content.trim()}`
    })
    .join('\n')

  const activeTopicMessage = [...history]
    .reverse()
    .find(m => (m.role === 'interjection' || m.role === 'topic') && m.content?.trim())

  const activeTopicLabel = activeTopicMessage?.role === 'interjection'
    ? 'Current topic correction / active focus'
    : 'Current topic'

  const activeTopicBlock = activeTopicMessage?.content?.trim()
    ? `${activeTopicLabel}:\n${activeTopicMessage.content.trim()}\n\nThis is the active focus of the debate and has priority over earlier tangents, side debates, inferred subtopics, or participant framings. If there is any conflict between the active topic and the direction of the conversation, follow the active topic.`
    : ''

  const activeTopicUrls = activeTopicMessage?.content ? [...new Set((String(activeTopicMessage.content).match(/https?:\/\/[^\s"'<>)]+/g) || []))] : []
  const sourcePriorityBlock = activeTopicUrls.length > 0
    ? `Primary source URLs in the active topic:\n${activeTopicUrls.map(url => `- ${url}`).join('\n')}\n\nUse these source URLs as your first factual reference. If they already provide enough information, do not perform additional web search. Search the web only to verify missing details or add necessary context beyond the provided source.`
    : ''

  const topicDirectiveBlock = topicDirectives
    ? `Topic directives history:\n${topicDirectives}\n\nTreat topic and topic updates as authoritative steering instructions from outside the debate flow, not as conversational turns by any participant or by the moderator.`
    : ''

  const docsBlock = attachedDocs.length > 0
    ? `\n\nAttached context documents:\n${attachedDocs.map(d => `## ${d.name}\n${d.content}`).join('\n\n')}`
    : ''

  const participantConstraints = (actor.constraints || [])
    .map(entry => typeof entry === 'string' ? { text: entry, override: false } : { text: String(entry?.text ?? ''), override: !!entry?.override })
    .filter(entry => entry.text.trim())
  const overrideConstraints = participantConstraints.filter(entry => entry.override)
  const personalConstraints = participantConstraints.filter(entry => !entry.override)

  const debateHasModerator = allParticipants.some(p => p.isModerator && p.id !== actor.id)
  const hasNonContainmentModerator = allParticipants.some(p => p.isModerator && moderatorModeOf(p) !== 'containment')
  const moderatorAuthorityBoundary = hasNonContainmentModerator
    ? "Moderator authority boundary:\nThe moderator's procedural decisions are binding. Their substantive claims are arguments like those of any other participant and may be challenged."
    : ''
  const latestModeratorDirective = [...history]
    .reverse()
    .map(message => {
      const moderator = allParticipants.find(participant => participant.tag === message.role && participant.isModerator)
      return moderator && message.content?.trim() ? { moderator, content: message.content.trim() } : null
    })
    .find(Boolean)

  const baselineRules = [
    ...(!actor.isModerator && debateHasModerator
      ? [
          '- A moderator holds procedural authority over this debate. If the moderator issues a process directive (de-escalation, topic redirection, turn assignment, format), comply with it in your next turn. You may keep defending your positions on content, but never ignore or overrule a moderator process directive.',
          '- Treat a moderator intervention as a binding procedural instruction, not as an ordinary peer argument. Do not debate, dismiss, reinterpret, or sidestep its directive; acknowledge it through your next response and follow its requested format or focus.',
        ]
      : []),
    '- Avoid referring to other participants unless it is strictly necessary for the argument you are making.',
    '- Distinguish clearly between observed facts and your inferences. If a point is not directly supported by the topic, cited material, or the discussion itself, present it only as a tentative hypothesis or avoid it.',
    '- Do not attribute internal motives, traffic strategy, business incentives, hidden intent, or undocumented decision-making to the subject unless such claims are explicitly supported by available evidence.',
    '- If you need up-to-date external information, you may use the available web search capability. Do not claim that you cannot browse, search the web, or verify information unless a tool call has actually failed or no relevant result is available.',
    '- If you think moderator intervention is needed, ask for it naturally in plain language. Do not use coded markers or special trigger syntax.',
    '- Treat the active topic as the primary obligation. Source material, cited links, and examples are supporting context only.',
    '- If the active topic asks for an opinion on a project, site, person, or initiative as a whole, do not pivot into discussing individual articles, games, side examples, or analogies unless you explicitly connect them back to that overall evaluation.',
    '- If another participant fixates on a side detail, do not follow them there by default. Pull the discussion back to the active topic.',
  ]

  const constraintsBlock = [
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

  const moderationBlock = actor.isModerator && externalModerationTrigger
    ? `\n\nModeration trigger:\nneeded=${externalModerationTrigger.needed ? 'true' : 'false'}\nreason=${externalModerationTrigger.reason || ''}`
    : ''

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
  const moderatorStyleText = moderatorMode === 'active'
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
        moderatorMode === 'active' || (externalModerationTrigger?.scheduledFacilitation && !reactiveModeration)
          ? ''
          : 'When you do intervene, output only moderation or process control. Do not continue the debate as if you were another participant.',
      ].filter(Boolean).join(' ')
    : ''

  const moderatorDirectiveBlock = !actor.isModerator && latestModeratorDirective
    ? `Latest moderator intervention (binding procedural instruction):\n${latestModeratorDirective.moderator.name || latestModeratorDirective.moderator.tag}: ${latestModeratorDirective.content}\n\nFollow this intervention in your next response. It governs process, tone, focus, and turn assignment; do not treat it as a debatable participant position.`
    : ''

  const defaultDeliveryStyle = 'Default delivery style: speak plainly and directly. Favor argumentative prose over performance. Avoid narrated gestures, stage directions, acted pauses, cinematic scene-setting, or theatrical framing unless they are explicitly required by a stronger instruction or by the participant\'s core identity.'

  return [
    reasoningLangLabel
      ? (skipTranslation
          ? `You are ${actor.name || actor.tag}. Do all internal reasoning and deliberation in ${reasoningLangLabel} (language code: ${reasoningLangCode}), and write your final visible response in ${reasoningLangLabel} as well — do not translate it into ${languageLabel}.`
          : `You are ${actor.name || actor.tag}. Do all internal reasoning and deliberation in ${reasoningLangLabel} (language code: ${reasoningLangCode}). Your final visible response, however, must be written only in ${languageLabel} (language code: ${uiLang}), as a faithful translation of that reasoning — never leave any part of the visible response in ${reasoningLangLabel} unless it is identical to ${languageLabel}.`)
      : `You are ${actor.name || actor.tag}. Respond in ${languageLabel} (language code: ${uiLang}).`,
    characterType ? `Character type: ${characterType.label}.` : '',
    responseLength?.instruction ? `Verbosity rule: ${responseLength.instruction}` : '',
    defaultDeliveryStyle,
    educationLevel?.instruction ? `Education style: ${educationLevel.instruction}` : '',
    ageGroup?.instruction ? `Age style: ${ageGroup.instruction}` : '',
    mood?.instruction ? `Mood: ${mood.instruction}` : '',
    mood?.instruction && moodIntensity?.instruction ? `Mood intensity: ${moodIntensity.instruction}` : '',
    modeBlock,
    moderatorAuthorityBoundary,
    affinityBlock,
    topicDirectiveBlock,
    activeTopicBlock,
    sourcePriorityBlock,
    characterContext ? `Character context:\n${characterContext}` : '',
    roster ? `Other participants:\n${roster}` : '',
    constraintsBlock ? `Constraints and behavior rules:\n${constraintsBlock}` : '',
    moderatorDecisionBlock,
    moderatorDirectiveBlock,
    moderationBlock,
    docsBlock,
  ].filter(Boolean).join('\n\n')
}
