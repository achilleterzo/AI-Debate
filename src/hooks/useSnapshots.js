import { useCallback } from 'react'
import { Session } from '../data/Session'
import { Debate } from '../debate/Debate'

export function useSnapshots({
  state,
  actions,
  refs,
  setTopicValue,
  invalidSnapshotMessage,
}) {
  const handleSaveSnapshot = useCallback(() => {
    const snapshot = Session.buildSnapshotData({
      ...state,
      turn: refs.turn.current,
      constants: Debate.sessionConstants(),
    })
    Session.downloadSnapshot(snapshot, { topic: state.topic, messages: state.messages })
  }, [refs.turn, state])

  const handleLoadSnapshot = useCallback(() => {
    Session.promptSnapshotFile({
      onData: data => {
        if (data.participants?.length >= 2) {
          actions.setParticipants(Debate.hydrateParticipantsFromSession(data.participants))
        }
        if (Array.isArray(data.globalConstraints)) actions.setGlobalConstraints(data.globalConstraints.filter(Boolean))
        if (typeof data.generalPersonalityInstructions === 'string') actions.setGeneralPersonalityInstructions(data.generalPersonalityInstructions)
        if (typeof data.customConclusionPrompt === 'string') actions.setCustomConclusionPrompt(data.customConclusionPrompt)
        if (typeof data.standardConclusionPrompt === 'string') actions.setStandardConclusionPrompt(data.standardConclusionPrompt)
        if (data.maxTurns != null) actions.setMaxTurns(data.maxTurns)
        if (data.recentK != null) actions.setRecentK(data.recentK)
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
          const loaded = data.messages.filter(message => message.role === 'topic' || message.role === 'user' || message.role === 'interjection' || message.role === 'error' || (message.content && message.content.trim()))
          let sequence = 0
          const messages = loaded.map(message => message.seq != null ? (sequence = Math.max(sequence, message.seq), message) : { ...message, seq: ++sequence })
          refs.sequence.current = sequence
          actions.setMessages(messages)
        }
        if (data.conclusions?.length) {
          const conclusions = data.conclusions.map(conclusion => conclusion.seq != null ? (refs.sequence.current = Math.max(refs.sequence.current, conclusion.seq), conclusion) : { ...conclusion, seq: ++refs.sequence.current })
          actions.setConclusions(conclusions)
        }
        if (data.summary) {
          refs.summary.current = data.summary
          actions.setSummary(data.summary)
        }
        if (data.turn) refs.turn.current = data.turn
      },
      onError: () => alert(invalidSnapshotMessage),
    })
  }, [actions, invalidSnapshotMessage, refs.sequence, refs.summary, refs.turn, setTopicValue])

  return { handleSaveSnapshot, handleLoadSnapshot }
}
