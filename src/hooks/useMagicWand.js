import { useCallback, useRef, useState } from 'react'
import { Debate } from '../debate/Debate'
import { streamChat } from '../debate/Stream'
import { UI_LANGUAGE_OPTIONS } from '../i18n/UiStrings'
import { outputLanguagePhrase } from '../prompts/LanguagePrompt'
import { CHARACTER_TYPES } from '../dataset/CharacterTypes'
import { MOODS } from '../prompts/Moods'
import { MOOD_INTENSITY } from '../prompts/MoodIntensity'
import { EDUCATION_LEVELS } from '../prompts/EducationLevels'
import { AGE_GROUPS } from '../prompts/AgeGroups'
import { DEBATE_MODES } from '../prompts/Modes'
import {
  DEFAULT_SUGGESTION_COUNT,
  SUGGESTION_MODE,
  buildGlobalRulesPrompt,
  buildParticipantConstraintPrompt,
  buildParticipantPrompt,
  buildParticipantSystemPrompt,
  buildSuggestionPrompt,
  buildSuggestionSystemPrompt,
  isConstraintMode,
  isParticipantMode,
  modeIndex,
  parseParticipantDrafts,
  parseSuggestions,
} from '../services/Suggestions'

export const WAND_STATUS = {
  IDLE: 'idle',
  LOADING: 'loading',
  READY: 'ready',
  ERROR: 'error',
}

// Enough context to be useful without turning a helper call into a heavy request.
const WAND_CONVERSATION_LIMIT = 4000
const WAND_MESSAGE_LIMIT = 400
const PARTICIPANT_DRAFT_COUNT = 3

// The tools a ground rule can send the table to when a claim is disputed.
// Named in the prompt only while they are switched on: a rule pointing at a
// tool nobody has is an instruction to invent the result.
const VERIFICATION_TOOLS = ['web_search', 'fetch_url', 'get_recent_messages']

const CLOSED = { mode: null, status: WAND_STATUS.IDLE, suggestions: [], error: null }

function constraintTexts(participant) {
  return (participant?.constraints || [])
    .map(entry => (typeof entry === 'string' ? entry : entry?.text))
    .filter(Boolean)
}

/**
 * The participant as its selectors have it, in English, for the prompt.
 *
 * Only settings that actually shape a turn are listed: a value left at the
 * default says nothing about this participant, and spending prompt on it
 * invites a rule that restates a default nobody chose.
 */
function describeParticipantConfig(participant) {
  if (!participant) return []
  const characterType = CHARACTER_TYPES.find(entry => entry.value === participant.characterType)
  const mood = MOODS.find(entry => entry.id === participant.mood)
  const intensity = MOOD_INTENSITY[participant.moodIntensity]
  const education = EDUCATION_LEVELS.find(entry => entry.value === participant.educationLevel)
  const age = AGE_GROUPS[participant.ageGroup]

  return [
    participant.characterType && characterType ? `Character type: ${characterType.labelEn}` : '',
    mood?.instruction ? `Debating attitude: ${mood.labelEn}${intensity?.labelEn ? ` (${intensity.labelEn} intensity)` : ''}` : '',
    age?.instruction ? `Age group: ${age.labelEn}` : '',
    education?.instruction ? `Education: ${education.labelEn}` : '',
    participant.responseLength ? `Response length: ${participant.responseLength}` : '',
    participant.reasoningLang ? `Reasons in: ${participant.reasoningLang}` : '',
  ].filter(Boolean)
}

export function useMagicWand({
  baseUrl,
  defaultModel,
  participants,
  summaryModelOverride,
  messages,
  topicRef,
  attachedDocs = [],
  summaryRef,
  uiLang,
  debateMode = 'free',
  globalConstraints = [],
  enabledTools = null,
  timeoutSec,
  setLastPromptEstimate,
  setLastRequest,
  ollamaOk = null,
}) {
  const [state, setState] = useState(CLOSED)
  const inFlightRef = useRef(null)

  // The user asked for the default model; fall back to whatever the debate is
  // already able to run so the wand still works when no default is configured.
  const model = defaultModel
    || Debate.pickOperationalModel(participants, summaryModelOverride)

  // Suggestions go through the general endpoint, so there is nothing the wand
  // can do while that endpoint is unreachable or still being probed.
  const online = ollamaOk === true
  const available = !!model && online
  const unavailableReason = !online ? 'offline' : !model ? 'noModel' : null

  const close = useCallback(() => {
    inFlightRef.current?.abort()
    inFlightRef.current = null
    setState(CLOSED)
  }, [])

  const generate = useCallback(async (mode) => {
    if (!model || !online) return

    inFlightRef.current?.abort()
    const controller = new AbortController()
    inFlightRef.current = controller

    setState({ mode, status: WAND_STATUS.LOADING, suggestions: [], error: null })

    const languageNamed = outputLanguagePhrase(uiLang)
    // The text currently being drafted is the user's active instruction. On
    // resume, prefer it over the original topic stored in the conversation.
    // Read at click time, not at render time: the field's text lives in a ref
    // precisely so that typing it does not re-render the app.
    const topicText = (topicRef?.current || '').trim() || messages.find(message => message.role === 'topic')?.content || ''
    const forParticipant = isParticipantMode(mode)
    const forConstraint = isConstraintMode(mode)
    const forGlobalRule = mode === SUGGESTION_MODE.GLOBAL_RULE
    const participantIndex = forParticipant || forConstraint ? modeIndex(mode) : -1
    const languageCodes = UI_LANGUAGE_OPTIONS.map(entry => entry.code)
    const moodIds = MOODS.map(entry => entry.id)
    const selectedDebateMode = DEBATE_MODES.find(entry => entry.id === debateMode) ?? DEBATE_MODES[0]
    const debateModeContext = {
      debateMode: selectedDebateMode.id,
      debateModeLabel: selectedDebateMode.labelEn,
      debateModeInstruction: selectedDebateMode.instruction || '',
    }

    let systemPrompt
    let userPrompt
    if (forParticipant) {
      const target = participants[participantIndex]
      const characterType = target?.characterType ?? null
      const characterTypeLabel = CHARACTER_TYPES.find(entry => entry.value === characterType)?.labelEn ?? 'person'
      const isModerator = !!target?.isModerator || target?.mood === 'moderator'
      systemPrompt = buildParticipantSystemPrompt({ languageNamed })
      userPrompt = buildParticipantPrompt({
        characterType,
        characterTypeLabel,
        languageNamed,
        isModerator,
        moderatorMode: isModerator ? Debate.normalizeModeratorMode(target) : 'containment',
        ...debateModeContext,
        topic: topicText,
        others: participants
          .filter((_, index) => index !== participantIndex)
          .map(other => ({
            name: other.name,
            tag: other.tag,
            traits: (other.constraints || []).map(entry => (typeof entry === 'string' ? entry : entry?.text)),
          })),
        count: PARTICIPANT_DRAFT_COUNT,
        languageOptions: languageCodes,
        moodOptions: moodIds,
      })
    } else if (forConstraint) {
      const target = participants[participantIndex]
      systemPrompt = buildSuggestionSystemPrompt({ languageNamed })
      userPrompt = buildParticipantConstraintPrompt({
        languageNamed,
        name: target?.name || '',
        tag: target?.tag || '',
        isModerator: !!target?.isModerator,
        moderatorMode: target?.isModerator ? Debate.normalizeModeratorMode(target) : 'containment',
        profile: describeParticipantConfig(target),
        existing: constraintTexts(target),
        others: participants
          .filter((_, index) => index !== participantIndex)
          .map(other => ({ name: other.name, tag: other.tag, isModerator: !!other.isModerator })),
        ...debateModeContext,
        topic: topicText,
        count: DEFAULT_SUGGESTION_COUNT,
      })
    } else if (forGlobalRule) {
      systemPrompt = buildSuggestionSystemPrompt({ languageNamed })
      userPrompt = buildGlobalRulesPrompt({
        ...debateModeContext,
        languageNamed,
        // What the user is steering the table toward is the purpose here, the
        // same role the wizard's opening question plays.
        purpose: topicText,
        existing: globalConstraints,
        verificationTools: VERIFICATION_TOOLS.filter(tool => enabledTools?.[tool] !== false),
        count: DEFAULT_SUGGESTION_COUNT,
      })
    } else {
      systemPrompt = buildSuggestionSystemPrompt({ languageNamed })
      userPrompt = buildSuggestionPrompt({
        mode,
        ...debateModeContext,
        languageNamed,
        topic: topicText,
        attachedDocs,
        conversation: Debate.buildConclusionConversation(messages, participants, {
          limit: WAND_CONVERSATION_LIMIT,
          messageLimit: WAND_MESSAGE_LIMIT,
        }),
        summary: summaryRef?.current || '',
        participants,
        count: DEFAULT_SUGGESTION_COUNT,
      })
    }

    let raw = ''
    try {
      await streamChat({
        baseUrl,
        model,
        systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        useTools: false,
        onEstimate: setLastPromptEstimate,
        onPayload: request => setLastRequest?.({ request }),
        onResponse: exchange => setLastRequest?.(exchange),
        onToken: token => { raw = token },
        timeoutMs: timeoutSec * 1000,
      })
    } catch (error) {
      if (controller.signal.aborted) return
      inFlightRef.current = null
      setState({ mode, status: WAND_STATUS.ERROR, suggestions: [], error: error.message })
      return
    }

    if (controller.signal.aborted) return
    inFlightRef.current = null

    const suggestions = forParticipant
      ? parseParticipantDrafts(raw, { max: PARTICIPANT_DRAFT_COUNT, languageOptions: languageCodes, moodOptions: moodIds, defaultResponseLength: participants[participantIndex]?.isModerator ? null : 'short' })
      : parseSuggestions(raw, { max: DEFAULT_SUGGESTION_COUNT })
    setState(suggestions.length > 0
      ? { mode, status: WAND_STATUS.READY, suggestions, error: null }
      : { mode, status: WAND_STATUS.ERROR, suggestions: [], error: null })
  }, [
    attachedDocs, baseUrl, messages, model, online, participants, setLastPromptEstimate, setLastRequest,
    summaryRef, timeoutSec, topicRef, uiLang, debateMode, globalConstraints, enabledTools,
  ])

  return {
    ...state,
    model,
    available,
    unavailableReason,
    isLoading: state.status === WAND_STATUS.LOADING,
    generate,
    close,
  }
}
