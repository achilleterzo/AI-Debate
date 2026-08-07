import { useCallback, useEffect, useRef, useState } from 'react'
import { Storage } from '../data/Storage'
import { Web } from '../services/Web'
import { Debate } from '../debate/Debate'

export function useTopicComposer({
  participants,
  defaultModel,
  messages,
  maxTurns,
  useSummary,
  contextEstimate,
  interjectRef,
  roundLimitRef,
  summaryRef,
  turnRef,
  forkedRef,
  startDebate,
  queueInterjection,
  setMessages,
  setSummary,
  setSummaryDebug,
  setSummaryInProgress,
  setHeaderOpen,
}) {
  // The text itself lives in the ref, never in state. Nothing rendered by App
  // needs the characters — the buttons and labels only ask whether the field is
  // empty — so keeping the text in state made every keystroke re-render the
  // whole app, timeline included, and the cost grew with the debate.
  const [hasTopic, setHasTopic] = useState(false)
  const [topicDropOpen, setTopicDropOpen] = useState(false)
  const [topicHistory, setTopicHistory] = useState(Storage.loadTopics)
  const topicRef = useRef('')
  const hasTopicRef = useRef(false)
  const textareaRef = useRef(null)
  const topicWrapRef = useRef(null)

  // Fires on the empty/non-empty transition and on nothing else: the buttons
  // still light up on the first character, synchronously, but the characters
  // after it cost no render at all.
  const syncTopicFlag = useCallback(value => {
    const next = String(value ?? '').trim().length > 0
    if (hasTopicRef.current === next) return
    hasTopicRef.current = next
    setHasTopic(next)
  }, [])

  const flushTopic = useCallback(() => {
    const value = topicRef.current
    syncTopicFlag(value)
    return value
  }, [syncTopicFlag])

  const setTopicValue = useCallback(value => {
    topicRef.current = value
    if (textareaRef.current) textareaRef.current.value = value
    syncTopicFlag(value)
  }, [syncTopicFlag])

  useEffect(() => {
    if (!topicDropOpen) return
    const close = event => {
      if (topicWrapRef.current && !topicWrapRef.current.contains(event.target)) setTopicDropOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [topicDropOpen])

  const logLaunchEstimate = useCallback(mode => {
    console.log('[context-estimate]', {
      mode,
      useSummary,
      summaryChars: contextEstimate.summaryChars,
      conversationChars: contextEstimate.convChars,
      effectiveChars: contextEstimate.baseChars,
      estimatedTokens: contextEstimate.estTokens,
      participants: participants.length,
      topicChars: topicRef.current.length,
    })
  }, [contextEstimate, participants.length, useSummary])

  const handleStart = useCallback((topicInput = topicRef.current) => {
    const topicText = topicInput.trim()
    if (!topicText || participants.some(participant => !Debate.hasConfiguredModel(participant, defaultModel))) return
    logLaunchEstimate('start')
    Storage.saveTopicToHistory(topicText)
    setTopicHistory(Storage.loadTopics())
    setTopicDropOpen(false)
    interjectRef.current = null

    if (messages.length > 0) {
      setSummaryDebug(null)
      setSummaryInProgress(false)
      setHeaderOpen(false)
      startDebate({
        resumeMessages: messages,
        resumeRound: turnRef.current,
        resumeSummary: summaryRef.current,
        injectTopic: topicText,
      })
      setTopicValue('')
      return
    }

    // A fork also starts with an empty transcript, but everything the branch
    // accumulated is meant to survive it: the summary of what was said, the
    // pages already fetched. Only a genuine fresh start clears them.
    const forked = !!forkedRef?.current
    if (forkedRef) forkedRef.current = false

    if (!forked) {
      summaryRef.current = ''
      setSummary('')
      setSummaryDebug(null)
      setSummaryInProgress(false)
      Web.clearCaches()
    }
    turnRef.current = { round: 0, step: 0 }
    setMessages([])
    setHeaderOpen(false)
    startDebate({
      resumeMessages: null,
      resumeRound: null,
      resumeSummary: forked ? summaryRef.current : '',
      injectTopic: topicText,
      preserveContext: forked,
    })
    setTopicValue('')
  }, [defaultModel, forkedRef, interjectRef, logLaunchEstimate, messages, participants, setHeaderOpen, setMessages, setSummary, setSummaryDebug, setSummaryInProgress, setTopicValue, startDebate, summaryRef, turnRef])

  const handleResume = useCallback((topicInput = topicRef.current) => {
    if (messages.length === 0) return
    logLaunchEstimate('resume')
    interjectRef.current = null
    const injectTopic = topicInput.trim() || null
    setTopicValue('')
    const currentRound = turnRef.current?.round ?? 0
    const roundLimit = roundLimitRef.current > 0 ? roundLimitRef.current : maxTurns
    if (roundLimit > 0 && currentRound >= roundLimit) roundLimitRef.current = currentRound + (maxTurns || 1)

    startDebate({
      resumeMessages: messages.filter(message => message.role !== 'error'),
      resumeRound: turnRef.current,
      resumeSummary: summaryRef.current,
      injectTopic,
    })
  }, [interjectRef, logLaunchEstimate, maxTurns, messages, roundLimitRef, setTopicValue, startDebate, summaryRef, turnRef])

  const handleInterjection = useCallback(() => {
    const text = topicRef.current.trim()
    if (text) queueInterjection(text, () => setTopicValue(''))
  }, [queueInterjection, setTopicValue])

  const removeHistoryEntry = useCallback(index => {
    const next = topicHistory.filter((_, entryIndex) => entryIndex !== index)
    Storage.overwriteTopics(next)
    setTopicHistory(next)
    if (next.length === 0) setTopicDropOpen(false)
  }, [topicHistory])

  return {
    hasTopic,
    syncTopicFlag,
    topicRef,
    textareaRef,
    topicWrapRef,
    topicDropOpen,
    setTopicDropOpen,
    topicHistory,
    flushTopic,
    setTopicValue,
    handleStart,
    handleResume,
    handleInterjection,
    removeHistoryEntry,
  }
}
