import { useCallback, useRef, useState } from 'react'
import { Debate } from '../debate/Debate'
import { streamChat } from '../debate/Stream'
import { UI_LANGUAGE_OPTIONS } from '../i18n/UiStrings'
import { CHARACTER_TYPES } from '../dataset/CharacterTypes'
import { outputLanguagePhrase } from '../prompts/LanguagePrompt'
import { MOODS } from '../prompts/Moods'
import { DEBATE_MODES } from '../prompts/Modes'
import {
  buildGlobalRulesPrompt,
  buildParticipantPrompt,
  buildParticipantSystemPrompt,
  buildSuggestionSystemPrompt,
  parseParticipantDrafts,
  parseSuggestions,
} from '../services/Suggestions'

export const WIZARD_STATUS = { IDLE: 'idle', RUNNING: 'running', ERROR: 'error' }

/** Ground rules asked of the model, few enough to stay readable as chips. */
const GLOBAL_RULES_COUNT = 3

export const WIZARD_MIN_PARTICIPANTS = 2
export const WIZARD_MAX_PARTICIPANTS = 6

/** Keeps the first persona holding a name, case- and spacing-insensitively. */
export function dropDuplicateNames(drafts = []) {
  const seen = new Set()
  return drafts.filter(draft => {
    const key = String(draft?.name ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Runs the setup wizard's generation.
 *
 * Debaters, moderator and shared rules are three separate requests because
 * they are three different asks: the participant prompt already phrases itself
 * differently for a moderator, and mixing the rules into the same answer would
 * make one malformed reply cost everything. A failed step aborts before
 * anything is applied — the caller only ever sees a complete result.
 */
export function useDebateWizard({
  baseUrl,
  defaultModel,
  participants,
  summaryModelOverride,
  timeoutSec,
  ollamaOk = null,
  setLastPromptEstimate,
  setLastRequest,
}) {
  const [status, setStatus] = useState(WIZARD_STATUS.IDLE)
  const [step, setStep] = useState(null)
  const [error, setError] = useState(null)
  const inFlightRef = useRef(null)

  const model = defaultModel || Debate.pickOperationalModel(participants, summaryModelOverride)
  const online = ollamaOk === true
  const available = !!model && online
  const unavailableReason = !online ? 'offline' : !model ? 'noModel' : null

  const cancel = useCallback(() => {
    inFlightRef.current?.abort()
    inFlightRef.current = null
    setStatus(WIZARD_STATUS.IDLE)
    setStep(null)
  }, [])

  const generate = useCallback(async ({
    debateMode = 'free',
    uiLang = 'en',
    count = WIZARD_MIN_PARTICIPANTS,
    characterType = null,
    withModerator = false,
    purpose = '',
  }) => {
    if (!model || !online) return null

    inFlightRef.current?.abort()
    const controller = new AbortController()
    inFlightRef.current = controller
    setStatus(WIZARD_STATUS.RUNNING)
    setError(null)

    const languageNamed = outputLanguagePhrase(uiLang)
    const languageCodes = UI_LANGUAGE_OPTIONS.map(entry => entry.code)
    const moodIds = MOODS.map(entry => entry.id)
    const selectedMode = DEBATE_MODES.find(entry => entry.id === debateMode) ?? DEBATE_MODES[0]
    const modeContext = {
      debateMode: selectedMode.id,
      debateModeLabel: selectedMode.labelEn,
      debateModeInstruction: selectedMode.instruction || '',
    }

    const ask = async (systemPrompt, userPrompt) => {
      let raw = ''
      await streamChat({
        baseUrl,
        model,
        systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        useTools: false,
        // These are three JSON-shaped setup calls, not deliberation: thinking
        // only burns time, and models that cannot think reject the request.
        think: false,
        onEstimate: setLastPromptEstimate,
        onPayload: request => setLastRequest?.({ request }),
        onResponse: exchange => setLastRequest?.(exchange),
        onToken: token => { raw = token },
        timeoutMs: timeoutSec * 1000,
      })
      return raw
    }

    const askForPersonas = async ({ isModerator, howMany, others = [] }) => {
      const raw = await ask(
        buildParticipantSystemPrompt({ languageNamed }),
        buildParticipantPrompt({
          characterType,
          characterTypeLabel: CHARACTER_TYPES.find(entry => entry.value === characterType)?.labelEn ?? 'person',
          isModerator,
          moderatorMode: Debate.DEFAULT_MODERATOR_MODE,
          ...modeContext,
          topic: purpose,
          // The moderator is a second request, so it has to be told who is
          // already seated — otherwise it invents a persona the table already
          // has, and two rows end up sharing one name.
          others: others.map(draft => ({ name: draft.name, traits: draft.traits })),
          count: howMany,
          languageOptions: languageCodes,
          moodOptions: moodIds,
        }),
      )
      return parseParticipantDrafts(raw, {
        max: howMany,
        languageOptions: languageCodes,
        moodOptions: moodIds,
        defaultResponseLength: isModerator ? null : 'short',
      })
    }

    try {
      setStep('participants')
      const drafts = await askForPersonas({ isModerator: false, howMany: count })
      if (controller.signal.aborted) return null
      if (drafts.length === 0) throw new Error('empty')

      let moderatorDraft = null
      if (withModerator) {
        setStep('moderator')
        const [draft] = await askForPersonas({ isModerator: true, howMany: 1, others: drafts })
        if (controller.signal.aborted) return null
        if (!draft) throw new Error('empty')
        moderatorDraft = draft
      }

      setStep('rules')
      const rulesRaw = await ask(
        buildSuggestionSystemPrompt({ languageNamed }),
        buildGlobalRulesPrompt({ ...modeContext, purpose, count: GLOBAL_RULES_COUNT }),
      )
      if (controller.signal.aborted) return null
      const globalConstraints = parseSuggestions(rulesRaw, { max: GLOBAL_RULES_COUNT })

      // The moderator opens the table, so it takes the first slot. A name that
      // survives both requests twice is dropped rather than seated twice:
      // participants address each other by name, and a duplicate makes the
      // whole transcript ambiguous.
      const ordered = dropDuplicateNames(moderatorDraft ? [moderatorDraft, ...drafts] : drafts)
      const nextParticipants = ordered.map((draft, index) => Debate.participantFromDraft(index, draft, {
        characterType,
        isModerator: !!moderatorDraft && index === 0,
      }))

      inFlightRef.current = null
      setStatus(WIZARD_STATUS.IDLE)
      setStep(null)
      return { participants: nextParticipants, globalConstraints }
    } catch (err) {
      if (controller.signal.aborted) return null
      inFlightRef.current = null
      setStatus(WIZARD_STATUS.ERROR)
      setStep(null)
      setError(err.message === 'empty' ? null : err.message)
      return null
    }
  }, [baseUrl, model, online, setLastPromptEstimate, setLastRequest, timeoutSec])

  return {
    status,
    step,
    error,
    model,
    available,
    unavailableReason,
    isRunning: status === WIZARD_STATUS.RUNNING,
    generate,
    cancel,
  }
}
