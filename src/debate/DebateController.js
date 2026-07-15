import { useCallback, useEffect, useMemo, useRef } from 'react'
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
  const stopRef = useRef(false)
  const turnRef = useRef(0)
  const summaryRef = useRef('')
  const interjectRef = useRef(null)
  const roundLimitRef = useRef(0)
  const seqRef = useRef(0)
  const nextSeq = useCallback(() => ++seqRef.current, [])
  const userInputRejectRef = useRef(null)

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
    nextSeq,
    setLastPromptEstimate,
    setMessages,
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
    const interjection = {
      role: 'interjection',
      ollamaRole: 'user',
      content: text,
      turn: turnRef.current?.round ?? 0,
      seq: nextSeq(),
    }
    interjectRef.current = [...(interjectRef.current ?? []), interjection]
    clearTopic()
    setMessages(prev => Debate.appendInterjection(prev, interjection))
  }, [nextSeq, setMessages])

  return {
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
