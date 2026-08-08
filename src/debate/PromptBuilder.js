import { DEBATE_MODES, DEFAULT_DEBATE_MODE, normalizeDebateMode } from '../prompts/Modes'
import { buildDebateModePromptBlocks } from '../prompts/DebateModePrompt'
import { buildConstraintsBlock } from '../prompts/ConstraintsPrompt'
import { buildAffinityBlock } from '../prompts/AffinityPrompt'
import { buildLanguagePrompt } from '../prompts/LanguagePrompt'
import { DEFAULT_DELIVERY_STYLE } from '../prompts/DeliveryStyle'
import { buildModeratorPromptBlocks } from '../prompts/ModeratorPrompt'
import { NO_TOOL_CALL_PROTOCOL, STRUCTURED_TOOL_CALL_PROTOCOL } from '../prompts/ToolProtocol'
import { buildTopicPromptBlocks } from '../prompts/TopicPrompt'
import { CONTEXT_DISCIPLINE_BLOCK, REASONING_FOCUS_BLOCK, hasNativeReasoning } from '../prompts/ReasoningContext'

function taggedSection(tag, content) {
  const normalized = String(content || '').trim()
  return normalized ? `<${tag}>\n${normalized}\n</${tag}>` : ''
}

export function buildSystemPrompt({ actor, allParticipants, history, externalModerationTrigger = null, characterContext = null, uiLang = 'en', attachedDocs = [], globalConstraints = [], generalPersonalityInstructions = '', debateMode = DEFAULT_DEBATE_MODE, toolsAvailable = true, constants }) {
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
    REASONING_LANG_CUSTOM,
  } = constants

  const mood = MOODS.find(m => m.id === actor.mood) ?? MOODS.find(m => m.id === DEFAULT_MOOD)
  const mode = DEBATE_MODES.find(entry => entry.id === normalizeDebateMode(debateMode)) ?? DEBATE_MODES[0]
  const { modeBlock, rolePlayBlock, rolePlayParticipantRule } = buildDebateModePromptBlocks({ mode, isModerator: actor.isModerator })
  const moodIntensity = MOOD_INTENSITY[actor.moodIntensity ?? DEFAULT_MOOD_INTENSITY]
  const characterType = CHARACTER_TYPES.find(c => c.value === actor.characterType)
  const responseLength = RESPONSE_LENGTHS.find(r => r.value === actor.responseLength)
  const educationLevel = EDUCATION_LEVELS.find(e => e.value === actor.educationLevel)
  const ageGroup = AGE_GROUPS[actor.ageGroup ?? DEFAULT_AGE_GROUP]
  const identityBlock = buildLanguagePrompt({ actor, uiLang, languages: LANGUAGES, reasoningLangCustom: REASONING_LANG_CUSTOM })

  const roster = allParticipants
    .filter(p => p.id !== actor.id)
    .map(p => `- ${p.name || p.tag}${p.isModerator ? ' (moderator)' : ''}`)
    .join('\n')

  const affinityBlock = buildAffinityBlock({ actor, allParticipants })

  const { topicDirectiveBlock, activeTopicBlock, sourcePriorityBlock, docsBlock } = buildTopicPromptBlocks({ history, attachedDocs })

  const { moderatorAuthorityBoundary, moderatorDecisionBlock, moderatorDirectiveBlock } = buildModeratorPromptBlocks({
    actor,
    allParticipants,
    history,
    mode,
    externalModerationTrigger,
    toolsAvailable,
  })

  const moderationBlock = actor.isModerator && externalModerationTrigger
    ? `\n\nModeration trigger:\nneeded=${externalModerationTrigger.needed ? 'true' : 'false'}\nreason=${externalModerationTrigger.reason || ''}`
    : ''
  const moderationInterventionNeeded = actor.isModerator
    && mode.id !== 'role_play'
    && externalModerationTrigger?.needed
  // Without a tools array the tool-based intervention cannot happen, and
  // demanding it only produces a pseudo-call. The intervention is still owed:
  // it is written as the visible turn instead.
  const moderationToolRequirement = !moderationInterventionNeeded
    ? ''
    : toolsAvailable
      ? 'A procedural intervention is required in this turn. Before writing ANY visible response, you MUST emit one structured apply_moderation tool call with the concise reason/directive. Do not explain, quote, or simulate the intervention in visible text. The tool call creates the separate moderation message. After the tool result, output exactly [SKIP_TURN] unless your active moderator style explicitly requires a separate substantive contribution.'
      : 'A procedural intervention is required in this turn. You have no tools available, so write it directly as your visible response: the concise reason and directive, nothing else. Do not mention tools, and do not write any call-shaped text.'

  const constraintsBlock = buildConstraintsBlock({ actor, allParticipants, globalConstraints, generalPersonalityInstructions })

  return [
    taggedSection('context_discipline', CONTEXT_DISCIPLINE_BLOCK),
    // Instructions for a deliberation step this participant will not take are
    // dead weight in every turn, so they follow the thinking level.
    taggedSection('reasoning_focus', hasNativeReasoning(actor) ? REASONING_FOCUS_BLOCK : ''),
    taggedSection('identity', identityBlock),
    taggedSection('character_profile', characterType ? `Character type: ${characterType.label}.` : ''),
    taggedSection('response_style', [
      responseLength?.instruction ? `Verbosity rule: ${responseLength.instruction}` : '',
      DEFAULT_DELIVERY_STYLE,
      educationLevel?.instruction ? `Education style: ${educationLevel.instruction}` : '',
      ageGroup?.instruction ? `Age style: ${ageGroup.instruction}` : '',
      mood?.instruction ? `Mood: ${mood.instruction}` : '',
      mood?.instruction && moodIntensity?.instruction ? `Mood intensity: ${moodIntensity.instruction}` : '',
    ].filter(Boolean).join('\n\n')),
    taggedSection('tool_protocol', toolsAvailable ? STRUCTURED_TOOL_CALL_PROTOCOL : NO_TOOL_CALL_PROTOCOL),
    taggedSection('debate_mode', modeBlock),
    taggedSection('role_play', [rolePlayBlock, rolePlayParticipantRule].filter(Boolean).join('\n\n')),
    taggedSection('moderator_authority', moderatorAuthorityBoundary),
    taggedSection('relational_affinity', affinityBlock),
    taggedSection('topic_directives', topicDirectiveBlock),
    taggedSection('active_topic', activeTopicBlock),
    taggedSection('source_priority', sourcePriorityBlock),
    taggedSection('character_context', characterContext),
    taggedSection('participants', roster ? `Other participants:\n${roster}` : ''),
    taggedSection('constraints', constraintsBlock ? `Constraints and behavior rules:\n${constraintsBlock}` : ''),
    taggedSection('moderator_instructions', [moderatorDecisionBlock, moderatorDirectiveBlock].filter(Boolean).join('\n\n')),
    taggedSection('moderation_trigger', moderationBlock),
    taggedSection('moderation_tool_requirement', moderationToolRequirement),
    taggedSection('attached_context', docsBlock),
  ].filter(Boolean).join('\n\n')
}
