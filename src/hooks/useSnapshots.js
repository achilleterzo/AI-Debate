import { useCallback } from 'react'
import { Session } from '../data/Session'
import { Debate } from '../debate/Debate'
import { normalizeDebateMode } from '../prompts/Modes'

export function useSnapshots({
  state,
  actions,
  refs,
  topicRef,
  setTopicValue,
  invalidSnapshotMessage,
  onExportImported,
}) {
  const handleSaveSnapshot = useCallback(() => {
    // The composer keeps its text in a ref so that typing does not re-render
    // the app, which means the current text is only readable at click time.
    const topic = topicRef?.current ?? ''
    const snapshot = Session.buildSnapshotData({
      ...state,
      topic,
      turn: refs.turn.current,
      constants: Debate.sessionConstants(),
    })
    Session.downloadSnapshot(snapshot, { topic, messages: state.messages })
  }, [refs.turn, state, topicRef])

  const handleLoadSnapshot = useCallback(() => {
    Session.promptSnapshotFile({
      // A JSON export is not a snapshot — it resolves state into labels for a
      // reader — but it does carry the conversation. Mapping it onto the
      // snapshot shape here keeps one code path below instead of two, and the
      // notice at the end says what an export could not bring with it.
      onData: raw => {
        const fromExport = Session.isExportedSession(raw)
        const data = fromExport ? Session.fromExportedSession(raw, Debate.sessionConstants()) : raw
        if (data.participants?.length >= 2) {
          actions.setParticipants(Debate.hydrateParticipantsFromSession(data.participants))
        }
        if (Array.isArray(data.globalConstraints)) actions.setGlobalConstraints(data.globalConstraints.filter(Boolean))
        if (typeof data.generalPersonalityInstructions === 'string') actions.setGeneralPersonalityInstructions(data.generalPersonalityInstructions)
        if (typeof data.debateMode === 'string') actions.setDebateMode(normalizeDebateMode(data.debateMode))
        if (typeof data.customConclusionPrompt === 'string') actions.setCustomConclusionPrompt(data.customConclusionPrompt)
        // Snapshots written before the guidance was kept per conclusion type
        // carry one string under the singular key; the setter spreads it.
        const standardPrompts = data.standardConclusionPrompts ?? data.standardConclusionPrompt
        if (typeof standardPrompts === 'string' || (standardPrompts && typeof standardPrompts === 'object')) {
          actions.setStandardConclusionPrompt(standardPrompts)
        }
        if (data.maxTurns != null) actions.setMaxTurns(data.maxTurns)
        if (data.timeoutSec != null) actions.setTimeoutSec(data.timeoutSec)
        if (data.moderationCooling != null) {
          const value = Number(data.moderationCooling)
          if (Number.isFinite(value) && value > 0) actions.setModerationCooling(Math.min(1, Math.max(0.01, value)))
        }
        if (data.useSummary != null) actions.setUseSummary(data.useSummary)
        if (data.summarizeAttachments != null) actions.setSummarizeAttachments(!!data.summarizeAttachments)
        if (data.baseUrl) {
          actions.setBaseUrl(data.baseUrl)
          actions.setEndpointInput(data.baseUrl)
        }
        if (data.version !== 2) return

        if (data.topic) setTopicValue(data.topic)
        if (data.messages?.length) {
          const loaded = Session.restorableMessages(data.messages)
          let sequence = 0
          const messages = loaded.map(message => message.seq != null ? (sequence = Math.max(sequence, message.seq), message) : { ...message, seq: ++sequence })
          refs.sequence.current = sequence
          actions.setMessages(messages)
        }
        if (data.conclusions?.length) {
          const conclusions = data.conclusions.map(conclusion => conclusion.seq != null ? (refs.sequence.current = Math.max(refs.sequence.current, conclusion.seq), conclusion) : { ...conclusion, seq: ++refs.sequence.current })
          actions.setConclusions(conclusions)
        }
        if (Array.isArray(data.memory)) actions.setMemory(data.memory)
        if (data.summary) {
          refs.summary.current = data.summary
          actions.setSummary(data.summary)
        }
        if (data.turn) refs.turn.current = data.turn
        // Last, so the notice lands on a session that is already on screen.
        if (fromExport) onExportImported?.()
      },
      onError: () => alert(invalidSnapshotMessage),
    })
  }, [actions, invalidSnapshotMessage, onExportImported, refs.sequence, refs.summary, refs.turn, setTopicValue])

  return { handleSaveSnapshot, handleLoadSnapshot }
}
