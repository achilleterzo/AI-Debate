import { useCallback, useRef, useState } from 'react'
import { Debate } from '../debate/Debate'
import { streamChat } from '../debate/Stream'
import { UI_LANGUAGE_OPTIONS } from '../i18n/UiStrings'
import { CHARACTER_TYPES } from '../dataset/CharacterTypes'
import { MOODS } from '../prompts/Moods'
import {
  DEFAULT_SUGGESTION_COUNT,
  buildParticipantPrompt,
  buildParticipantSystemPrompt,
  buildSuggestionPrompt,
  buildSuggestionSystemPrompt,
  isParticipantMode,
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

const CLOSED = { mode: null, status: WAND_STATUS.IDLE, suggestions: [], error: null }

export function useMagicWand({
  baseUrl,
  defaultModel,
  participants,
  summaryModelOverride,
  messages,
  topic,
  summaryRef,
  uiLang,
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

    const language = UI_LANGUAGE_OPTIONS.find(entry => entry.code === uiLang)?.label ?? uiLang
    const topicText = messages.find(message => message.role === 'topic')?.content || topic || ''
    const forParticipant = isParticipantMode(mode)
    const participantIndex = forParticipant ? Number(String(mode).split(':')[1]) : -1
    const languageCodes = UI_LANGUAGE_OPTIONS.map(entry => entry.code)
    const moodIds = MOODS.map(entry => entry.id)

    let systemPrompt
    let userPrompt
    if (forParticipant) {
      const target = participants[participantIndex]
      const characterType = target?.characterType ?? null
      const characterTypeLabel = CHARACTER_TYPES.find(entry => entry.value === characterType)?.labelEn ?? 'person'
      systemPrompt = buildParticipantSystemPrompt({ language, uiLang })
      userPrompt = buildParticipantPrompt({
        characterType,
        characterTypeLabel,
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
    } else {
      systemPrompt = buildSuggestionSystemPrompt({ language, uiLang })
      userPrompt = buildSuggestionPrompt({
        mode,
        topic: topicText,
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
      ? parseParticipantDrafts(raw, { max: PARTICIPANT_DRAFT_COUNT, languageOptions: languageCodes, moodOptions: moodIds })
      : parseSuggestions(raw, { max: DEFAULT_SUGGESTION_COUNT })
    setState(suggestions.length > 0
      ? { mode, status: WAND_STATUS.READY, suggestions, error: null }
      : { mode, status: WAND_STATUS.ERROR, suggestions: [], error: null })
  }, [
    baseUrl, messages, model, online, participants, setLastPromptEstimate, setLastRequest,
    summaryRef, timeoutSec, topic, uiLang,
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
