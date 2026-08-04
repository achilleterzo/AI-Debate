import { DEBATE_MODES, DEFAULT_DEBATE_MODE, normalizeDebateMode } from '../prompts/Modes'
import { buildDebateModePromptBlocks } from '../prompts/DebateModePrompt'
import { buildConstraintsBlock } from '../prompts/ConstraintsPrompt'
import { buildAffinityBlock } from '../prompts/AffinityPrompt'
import { buildLanguagePrompt } from '../prompts/LanguagePrompt'
import { DEFAULT_DELIVERY_STYLE } from '../prompts/DeliveryStyle'
import { buildModeratorPromptBlocks } from '../prompts/ModeratorPrompt'
import { STRUCTURED_TOOL_CALL_PROTOCOL } from '../prompts/ToolProtocol'
import { buildTopicPromptBlocks } from '../prompts/TopicPrompt'

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
  const { modeBlock, rolePlayBlock, rolePlayParticipantRule } = buildDebateModePromptBlocks({ mode, isModerator: actor.isModerator })
  const moodIntensity = MOOD_INTENSITY[actor.moodIntensity ?? DEFAULT_MOOD_INTENSITY]
  const characterType = CHARACTER_TYPES.find(c => c.value === actor.characterType)
  const responseLength = RESPONSE_LENGTHS.find(r => r.value === actor.responseLength)
  const educationLevel = EDUCATION_LEVELS.find(e => e.value === actor.educationLevel)
  const ageGroup = AGE_GROUPS[actor.ageGroup ?? DEFAULT_AGE_GROUP]
  const identityBlock = buildLanguagePrompt({ actor, uiLang, languages: LANGUAGES, reasoningLangFromConstraint: REASONING_LANG_FROM_CONSTRAINT, globalConstraints })

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
  })

  const moderationBlock = actor.isModerator && externalModerationTrigger
    ? `\n\nModeration trigger:\nneeded=${externalModerationTrigger.needed ? 'true' : 'false'}\nreason=${externalModerationTrigger.reason || ''}`
    : ''

  const constraintsBlock = buildConstraintsBlock({ actor, allParticipants, globalConstraints, generalPersonalityInstructions })

  return [
    identityBlock,
    characterType ? `Character type: ${characterType.label}.` : '',
    responseLength?.instruction ? `Verbosity rule: ${responseLength.instruction}` : '',
    DEFAULT_DELIVERY_STYLE,
    educationLevel?.instruction ? `Education style: ${educationLevel.instruction}` : '',
    ageGroup?.instruction ? `Age style: ${ageGroup.instruction}` : '',
    mood?.instruction ? `Mood: ${mood.instruction}` : '',
    mood?.instruction && moodIntensity?.instruction ? `Mood intensity: ${moodIntensity.instruction}` : '',
    STRUCTURED_TOOL_CALL_PROTOCOL,
    modeBlock,
    rolePlayBlock,
    rolePlayParticipantRule,
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
