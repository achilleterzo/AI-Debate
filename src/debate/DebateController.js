import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Debate } from './Debate'

export function useDebateController({
  participants,
  setParticipants,
  messages,
  setMessages,
  summary,
  setSummary,
  setSummaryDebug,
  setSummaryInProgress,
  maxTurns,
  recentK,
  timeoutSec,
  baseUrl,
  useSummary,
  attachedDocs,
  summarizeAttachments,
  summaryModelEnabled,
  summaryModelOverride,
  summaryAccumulate,
  summaryAccumulateThreshold,
  uiLang,
  debugMode,
  dynamicAffinity,
  moderationCooling,
  globalConstraints,
  generalPersonalityInstructions,
  setLastPromptEstimate,
  setStopping,
  setRunning,
  setStreamingSeq,
  setStreamingRole,
  setUserInputPending,
}) {
  const [participantHistory, setParticipantHistory] = useState([])

  const stopRef = useRef(false)
  const turnRef = useRef(0)
  const summaryRef = useRef('')
  const interjectRef = useRef(null)
  const roundLimitRef = useRef(0)
  const seqRef = useRef(0)
  const nextSeq = () => ++seqRef.current
  const userInputRejectRef = useRef(null)

  const participantHistoryRef = useRef([])
  const participantsRef = useRef(participants)
  const maxTurnsRef = useRef(maxTurns)
  const recentKRef = useRef(recentK)
  const timeoutSecRef = useRef(timeoutSec)
  const baseUrlRef = useRef(baseUrl)
  const useSummaryRef = useRef(useSummary)
  const characterContextRef = useRef({})
  const fetchedUrlsRef = useRef({})

  const conclusionConvRef = useRef('')

  const contextEstimate = useMemo(() => {
    const convText = messages
      .filter(message => !['error', 'participant_left', 'participant_joined'].includes(message.role))
      .map(message => message.content || '')
      .join('\n\n')
    const summaryChars = (summary || '').length
    const convChars = convText.length
    const baseChars = useSummary ? (summaryChars || convChars) : convChars
    const estTokens = Math.ceil(baseChars / 4)
    return { baseChars, estTokens, summaryChars, convChars }
  }, [messages, summary, useSummary])

  useEffect(() => { participantsRef.current = participants }, [participants])
  useEffect(() => { participantHistoryRef.current = participantHistory }, [participantHistory])
  useEffect(() => { maxTurnsRef.current = maxTurns }, [maxTurns])
  useEffect(() => { recentKRef.current = recentK }, [recentK])
  useEffect(() => { timeoutSecRef.current = timeoutSec }, [timeoutSec])
  useEffect(() => { baseUrlRef.current = baseUrl }, [baseUrl])
  useEffect(() => { useSummaryRef.current = useSummary }, [useSummary])

  const createRuntime = useCallback(() => ({
    stopRef,
    setStopping,
    setRunning,
    participantsRef,
    maxTurnsRef,
    timeoutSecRef,
    baseUrlRef,
    useSummaryRef,
    attachedDocs,
    summarizeAttachments,
    summaryModelEnabled,
    summaryModelOverride,
    uiLang,
    handlePromptEstimate: info => setLastPromptEstimate(info),
    setParticipantHistory,
    participantHistoryRef,
    characterContextRef,
    fetchedUrlsRef,
    setMessages,
    roundLimitRef,
    nextSeq,
    seqRef,
    summaryRef,
    summaryAccumulate,
    summaryAccumulateThreshold,
    debugMode,
    setSummaryInProgress,
    setSummary,
    dynamicAffinity,
    moderationCooling,
    setParticipants,
    setSummaryDebug,
    setStreamingSeq,
    setStreamingRole,
    globalConstraints,
    generalPersonalityInstructions,
    userInputRejectRef,
    setUserInputPending,
    turnRef,
    interjectRef,
    conclusionConvRef,
  }), [
    attachedDocs,
    debugMode,
    dynamicAffinity,
    generalPersonalityInstructions,
    globalConstraints,
    moderationCooling,
    setLastPromptEstimate,
    setMessages,
    setParticipantHistory,
    setParticipants,
    setRunning,
    setStopping,
    setStreamingRole,
    setStreamingSeq,
    setSummary,
    setSummaryDebug,
    setSummaryInProgress,
    setUserInputPending,
    summarizeAttachments,
    summaryAccumulate,
    summaryAccumulateThreshold,
    summaryModelEnabled,
    summaryModelOverride,
    uiLang,
  ])

  useEffect(() => {
    if (messages.length === 0) return
    const prev = participantHistoryRef.current
    if (prev.length === 0) return

    const lastEntry = prev[prev.length - 1]
    const lastParts = lastEntry.participants
    const newParts = participants

    const leftMsgs = []
    const joinMsgs = []
    const seq0 = seqRef.current

    for (const old of lastParts) {
      const cur = newParts.find(participant => participant.id === old.id)
      if (!cur) {
        leftMsgs.push({ role: 'participant_left', ollamaRole: 'system', content: '', turn: 0, seq: ++seqRef.current, participantSnapshot: old })
      } else if (cur.model !== old.model || cur.name !== old.name || !!cur.isModerator !== !!old.isModerator || (cur.endpointOverride ?? '') !== (old.endpointOverride ?? '')) {
        leftMsgs.push({ role: 'participant_left', ollamaRole: 'system', content: '', turn: 0, seq: ++seqRef.current, participantSnapshot: old })
        joinMsgs.push({ role: 'participant_joined', ollamaRole: 'system', content: '', turn: 0, seq: ++seqRef.current, participantSnapshot: cur })
      }
    }

    for (const cur of newParts) {
      if (!lastParts.find(participant => participant.id === cur.id)) {
        joinMsgs.push({ role: 'participant_joined', ollamaRole: 'system', content: '', turn: 0, seq: ++seqRef.current, participantSnapshot: cur })
      }
    }

    if (leftMsgs.length > 0 || joinMsgs.length > 0) {
      const entry = { seq: seq0 + 1, participants: newParts.map(participant => ({ ...participant })) }
      setParticipantHistory(history => [...history, entry])
      setMessages(prevMessages => [...prevMessages, ...leftMsgs, ...joinMsgs])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participants])

  const startDebate = useCallback(({ resumeMessages, resumeRound, resumeSummary, injectTopic, extraRounds = 0 }) => {
    Debate.start({
      resumeMessages,
      resumeRound,
      resumeSummary,
      injectTopic,
      extraRounds,
      runtime: createRuntime(),
    })
  }, [createRuntime])

  const stopDebate = useCallback(() => {
    stopRef.current = true
    setStopping(true)
    if (userInputRejectRef.current) {
      userInputRejectRef.current(new Error('stop'))
      userInputRejectRef.current = null
    }
  }, [setStopping])

  const queueInterjection = useCallback((text, clearTopic) => {
    interjectRef.current = text
    clearTopic()
    const pendingMsg = { role: 'interjection', ollamaRole: 'user', content: text, turn: null, pending: true }
    setMessages(prev => [...prev, pendingMsg])
  }, [setMessages])

  return {
    participantHistory,
    contextEstimate,
    turnRef,
    summaryRef,
    interjectRef,
    roundLimitRef,
    seqRef,
    nextSeq,
    startDebate,
    stopDebate,
    queueInterjection,
  }
}
