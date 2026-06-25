export function buildSystemPrompt({ actor, allParticipants, history, externalModerationTrigger = null, characterContext = null, uiLang = 'en', attachedDocs = [], globalConstraints = [], generalPersonalityInstructions = '', constants }) {
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
  } = constants

  const mood = MOODS.find(m => m.id === actor.mood) ?? MOODS.find(m => m.id === DEFAULT_MOOD)
  const moodIntensity = MOOD_INTENSITY[actor.moodIntensity ?? DEFAULT_MOOD_INTENSITY]
  const characterType = CHARACTER_TYPES.find(c => c.value === actor.characterType)
  const responseLength = RESPONSE_LENGTHS.find(r => r.value === actor.responseLength)
  const educationLevel = EDUCATION_LEVELS.find(e => e.value === actor.educationLevel)
  const ageGroup = AGE_GROUPS[actor.ageGroup ?? DEFAULT_AGE_GROUP]
  const languageLabel = LANGUAGES.find(l => l.code === uiLang)?.label ?? uiLang

  const roster = allParticipants
    .filter(p => p.id !== actor.id)
    .map(p => `- ${p.name || p.tag}${p.isModerator ? ' (moderator)' : ''}`)
    .join('\n')

  const recent = history
    .filter(m => !['topic', 'interjection', 'error', 'participant_joined', 'participant_left'].includes(m.role) && m.content?.trim())
    .slice(-8)
    .map(m => {
      if (m.role === 'user') return `[Moderator message]: ${m.content}`
      return `${m.role}: ${m.content}`
    })
    .join('\n\n')

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

  const constraintsBlock = [
    generalPersonalityInstructions?.trim(),
    ...(globalConstraints || []).map(text => `- ${text}`),
    ...((actor.constraints || []).map(text => `- ${text}`)),
    '- Avoid referring to other participants unless it is strictly necessary for the argument you are making.',
    '- Distinguish clearly between observed facts and your inferences. If a point is not directly supported by the topic, cited material, or the discussion itself, present it only as a tentative hypothesis or avoid it.',
    '- Do not attribute internal motives, traffic strategy, business incentives, hidden intent, or undocumented decision-making to the subject unless such claims are explicitly supported by available evidence.',
    '- If you need up-to-date external information, you may use the available web search capability. Do not claim that you cannot browse, search the web, or verify information unless a tool call has actually failed or no relevant result is available.',
    '- If you think moderator intervention is needed, ask for it naturally in plain language. Do not use coded markers or special trigger syntax.',
    '- Treat the active topic as the primary obligation. Source material, cited links, and examples are supporting context only.',
    '- If the active topic asks for an opinion on a project, site, person, or initiative as a whole, do not pivot into discussing individual articles, games, side examples, or analogies unless you explicitly connect them back to that overall evaluation.',
    '- If another participant fixates on a side detail, do not follow them there by default. Pull the discussion back to the active topic.',
  ].filter(Boolean).join('\n')

  const moderationBlock = actor.isModerator && externalModerationTrigger
    ? `\n\nModeration trigger:\nneeded=${externalModerationTrigger.needed ? 'true' : 'false'}\nreason=${externalModerationTrigger.reason || ''}`
    : ''

  const moderatorDecisionBlock = actor.isModerator
    ? [
        `Moderator mode: always_intervene=${actor.moderatorAlwaysIntervene ? 'true' : 'false'}, enforce_topic=${actor.moderatorEnforceTopic ? 'true' : 'false'}, fact_check=${actor.moderatorFactCheck ? 'true' : 'false'}.`,
        'You are a moderator, not a normal debate participant.',
        actor.moderatorAlwaysIntervene
          ? 'You may enter the thread proactively, you can contribute with normal opinions, arguments, interpretations, process guidance, fact-checking, or topic enforcement.'
          : 'Do not contribute normal opinions, arguments, interpretations, or content-level discussion of your own. Only intervene when moderation is genuinely needed.',
        'Intervene only for moderation purposes: personal attacks, escalating hostility, explicit natural-language requests for moderation, severe topic drift, unsupported speculation asserted as fact, fact-checking needs, or topic enforcement.',
        'If intervention is not genuinely needed, output exactly [SKIP_TURN].',
        'If you do intervene, output only moderation or process control. Do not continue the debate as if you were another participant.',
      ].join(' ')
    : ''

  const defaultDeliveryStyle = 'Default delivery style: speak plainly and directly. Favor argumentative prose over performance. Avoid narrated gestures, stage directions, acted pauses, cinematic scene-setting, or theatrical framing unless they are explicitly required by a stronger instruction or by the participant\'s core identity.'

  return [
    `You are ${actor.name || actor.tag}. Respond in ${languageLabel} (language code: ${uiLang}).`,
    characterType ? `Character type: ${characterType.label}.` : '',
    responseLength?.instruction ? `Verbosity rule: ${responseLength.instruction}` : '',
    defaultDeliveryStyle,
    educationLevel?.instruction ? `Education style: ${educationLevel.instruction}` : '',
    ageGroup?.instruction ? `Age style: ${ageGroup.instruction}` : '',
    mood?.instruction ? `Mood: ${mood.instruction}` : '',
    mood?.instruction && moodIntensity?.instruction ? `Mood intensity: ${moodIntensity.instruction}` : '',
    topicDirectiveBlock,
    activeTopicBlock,
    sourcePriorityBlock,
    characterContext ? `Character context:\n${characterContext}` : '',
    roster ? `Other participants:\n${roster}` : '',
    recent ? `Recent conversation:\n${recent}` : '',
    constraintsBlock ? `Constraints and behavior rules:\n${constraintsBlock}` : '',
    moderatorDecisionBlock,
    moderationBlock,
    docsBlock,
  ].filter(Boolean).join('\n\n')
}
