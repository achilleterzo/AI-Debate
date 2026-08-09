import { useCallback, useEffect, useRef } from 'react'
import { Storage } from '../data/Storage'

/**
 * Streaming rewrites the last message on every token, and each write serializes
 * the whole transcript. Saves coalesce on this delay: long enough that a running
 * debate does not pay for every token, short enough that a crash or a reload
 * costs at most the last couple of seconds of one turn.
 */
const SAVE_DEBOUNCE_MS = 1500

function isEmptyChat({ messages, conclusions, memory, summary }) {
  return messages.length === 0
    && conclusions.length === 0
    && memory.length === 0
    && !String(summary || '').trim()
}

/**
 * The chat in progress survives a reload and a restart.
 *
 * The transcript is state, the counters are refs, and both have to come back:
 * restoring the messages alone would put the next turn at round zero and let
 * new sequence numbers collide with the ones the restored messages already
 * carry. `restoredChat` is read once at first render by the caller, so the
 * splash screen can know there is a conversation to return to before anything
 * is painted.
 */
export function useChatPersistence({
  restoredChat,
  messages,
  setMessages,
  summary,
  setSummary,
  summaryRef,
  conclusions,
  setConclusions,
  memory,
  setMemory,
  memoryRef,
  seqRef,
  turnRef,
  roundLimitRef,
  onRestored,
}) {
  const restoredRef = useRef(false)

  useEffect(() => {
    if (restoredRef.current) return
    // Set before the early returns: until this is true nothing may be written,
    // or the empty state of the first render would erase the stored chat.
    restoredRef.current = true
    if (!restoredChat || isEmptyChat(restoredChat)) return

    const { messages: storedMessages, summary: storedSummary, conclusions: storedConclusions, memory: storedMemory } = restoredChat
    // A record written before the counters existed, or truncated to fit the
    // quota, still has the ids in the messages themselves.
    seqRef.current = Number.isFinite(restoredChat.seq)
      ? restoredChat.seq
      : storedMessages.reduce((highest, message) => Math.max(highest, message.seq ?? 0), 0)
    turnRef.current = restoredChat.turn && typeof restoredChat.turn === 'object'
      ? restoredChat.turn
      : { round: 0, step: 0 }
    roundLimitRef.current = Number.isFinite(restoredChat.roundLimit) ? restoredChat.roundLimit : 0
    summaryRef.current = storedSummary
    memoryRef.current = storedMemory

    setSummary(storedSummary)
    setConclusions(storedConclusions)
    setMemory(storedMemory)
    setMessages(storedMessages)
    onRestored?.(restoredChat)
  }, [memoryRef, onRestored, restoredChat, roundLimitRef, seqRef, setConclusions, setMemory, setMessages, setSummary, summaryRef, turnRef])

  const persist = useCallback(() => {
    if (!restoredRef.current) return
    const chat = {
      messages,
      summary,
      conclusions,
      memory,
      turn: turnRef.current,
      seq: seqRef.current,
      roundLimit: roundLimitRef.current,
    }
    // Resetting the chat leaves nothing worth returning to, and a stored record
    // of it would come back at the next launch as a conversation the user closed.
    if (isEmptyChat(chat)) Storage.clearChat()
    else Storage.saveChat(chat)
  }, [conclusions, memory, messages, roundLimitRef, seqRef, summary, turnRef])

  useEffect(() => {
    const timer = setTimeout(persist, SAVE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [persist])

  // Closing the window does not wait for a debounce. `pagehide` covers the
  // cases where `beforeunload` never fires.
  useEffect(() => {
    window.addEventListener('beforeunload', persist)
    window.addEventListener('pagehide', persist)
    return () => {
      window.removeEventListener('beforeunload', persist)
      window.removeEventListener('pagehide', persist)
    }
  }, [persist])
}
