import { useCallback, useEffect, useRef, useState } from 'react'
import { Storage } from '../data/Storage'
import { Web } from '../services/Web'

export function useTopicComposer({
  participants,
  messages,
  maxTurns,
  useSummary,
  contextEstimate,
  interjectRef,
  roundLimitRef,
  summaryRef,
  turnRef,
  startDebate,
  queueInterjection,
  setMessages,
  setSummary,
  setSummaryDebug,
  setSummaryInProgress,
  setHeaderOpen,
}) {
  const [topic, setTopic] = useState('')
  const [topicDropOpen, setTopicDropOpen] = useState(false)
  const [topicHistory, setTopicHistory] = useState(Storage.loadTopics)
  const topicRef = useRef('')
  const textareaRef = useRef(null)
  const topicWrapRef = useRef(null)

  const flushTopic = useCallback(() => {
    const value = topicRef.current
    setTopic(value)
    return value
  }, [])

  const setTopicValue = useCallback(value => {
    topicRef.current = value
    if (textareaRef.current) textareaRef.current.value = value
    setTopic(value)
  }, [])

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
    if (!topicText || participants.some(participant => !participant.model)) return
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

    summaryRef.current = ''
    setSummary('')
    setSummaryDebug(null)
    setSummaryInProgress(false)
    turnRef.current = { round: 0, step: 0 }
    setMessages([])
    Web.clearCaches()
    setHeaderOpen(false)
    startDebate({ resumeMessages: null, resumeRound: null, resumeSummary: '', injectTopic: topicText })
    setTopicValue('')
  }, [interjectRef, logLaunchEstimate, messages, participants, setHeaderOpen, setMessages, setSummary, setSummaryDebug, setSummaryInProgress, setTopicValue, startDebate, summaryRef, turnRef])

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
    const text = topicRef.current.trim() || topic.trim()
    if (text) queueInterjection(text, () => setTopicValue(''))
  }, [queueInterjection, setTopicValue, topic])

  const removeHistoryEntry = useCallback(index => {
    const next = topicHistory.filter((_, entryIndex) => entryIndex !== index)
    Storage.overwriteTopics(next)
    setTopicHistory(next)
    if (next.length === 0) setTopicDropOpen(false)
  }, [topicHistory])

  return {
    topic,
    setTopic,
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
