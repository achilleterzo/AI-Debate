import { useCallback, useEffect, useRef, useState } from 'react'
import { TWO_COLUMN_MIN_WIDTH } from '../settings/Settings'

/** Within this of the bottom the chat follows the stream on its own. */
const FOLLOW_DISTANCE_PX = 80

/**
 * How far up the button waits before appearing.
 *
 * Deliberately further than the follow distance. With one threshold for both
 * edges the button appeared and vanished repeatedly while the reader hovered
 * around it, and every flip is a render. Kept close enough to the follow
 * distance that the stretch where the chat has stopped following but the
 * button is not up yet is under one message tall.
 */
const SHOW_BUTTON_DISTANCE_PX = 160

/** How long `scrollIntoView` is left alone to finish its animation. */
const SMOOTH_SCROLL_MS = 600

export function useAppLayout({ messages, conclusions = [], streamingRole, headerOpen }) {
  const bottomRef = useRef(null)
  const chatRef = useRef(null)
  const headerTopRef = useRef(null)
  const summaryPanelRef = useRef(null)
  const inputAreaRef = useRef(null)
  const autoScrollRef = useRef(true)
  const scrollFrameRef = useRef(null)
  const scrollProbeRef = useRef(null)
  const smoothScrollUntilRef = useRef(0)
  const showScrollBtnRef = useRef(false)
  const [headerBodyHeight, setHeaderBodyHeight] = useState(360)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [isWideLayout, setIsWideLayout] = useState(() => typeof window !== 'undefined' && window.innerWidth >= TWO_COLUMN_MIN_WIDTH)

  const scheduleAutoScroll = useCallback(() => {
    if (!autoScrollRef.current || scrollFrameRef.current != null) return
    // Editing controls live inside the chat timeline (notably the conclusion
    // prompt). Their DOM updates must not fight the user's caret and scroll
    // position by forcing the whole timeline to the bottom.
    const active = document.activeElement
    if (active && chatRef.current?.contains(active) && active.matches('input, textarea, select, [contenteditable="true"]')) return
    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollFrameRef.current = null
      if (!autoScrollRef.current) return
      if (performance.now() < smoothScrollUntilRef.current) return
      const chat = chatRef.current
      if (!chat) return
      chat.scrollTop = chat.scrollHeight
      if (showScrollBtnRef.current) {
        showScrollBtnRef.current = false
        setShowScrollBtn(false)
      }
    })
  }, [])

  useEffect(() => { showScrollBtnRef.current = showScrollBtn }, [showScrollBtn])

  useEffect(() => () => {
    if (scrollFrameRef.current != null) window.cancelAnimationFrame(scrollFrameRef.current)
    if (scrollProbeRef.current != null) window.cancelAnimationFrame(scrollProbeRef.current)
  }, [])

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(min-width: ${TWO_COLUMN_MIN_WIDTH}px)`)
    const apply = () => setIsWideLayout(mediaQuery.matches)
    apply()
    mediaQuery.addEventListener('change', apply)
    return () => mediaQuery.removeEventListener('change', apply)
  }, [])

  // In single-column mode the accordion is an overlay anchored under the header
  // bar, so it fills exactly the band between the header and the prompt bar.
  // The summary panel is not subtracted on purpose: it sits underneath the
  // overlay, and subtracting it left a gap above the prompt bar.
  const recomputeHeaderBodyHeight = useCallback(() => {
    const viewportHeight = window.innerHeight || 0
    const headerTopHeight = headerTopRef.current?.offsetHeight ?? 0
    const inputHeight = inputAreaRef.current?.offsetHeight ?? 0
    const nextHeight = Math.max(200, Math.floor(viewportHeight - headerTopHeight - inputHeight))
    setHeaderBodyHeight(previous => Math.abs(previous - nextHeight) < 2 ? previous : nextHeight)
  }, [])

  useEffect(() => {
    if (!headerOpen) return
    const schedule = () => window.requestAnimationFrame(recomputeHeaderBodyHeight)
    schedule()
    window.addEventListener('resize', schedule)

    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule)
    if (headerTopRef.current) observer?.observe(headerTopRef.current)
    if (inputAreaRef.current) observer?.observe(inputAreaRef.current)

    return () => {
      window.removeEventListener('resize', schedule)
      observer?.disconnect()
    }
  }, [headerOpen, recomputeHeaderBodyHeight])

  useEffect(() => {
    const chat = chatRef.current
    if (!chat) return undefined

    const mutationObserver = typeof MutationObserver === 'undefined' ? null : new MutationObserver(() => {
      Array.from(chat.children).forEach(child => resizeObserver?.observe(child))
      scheduleAutoScroll()
    })
    // Text changes inside controls are not new chat content. Observing
    // characterData made every typed character schedule a full chat scroll.
    mutationObserver?.observe(chat, { childList: true, subtree: true })

    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
      scheduleAutoScroll()
    })
    const observeChildren = () => {
      resizeObserver?.observe(chat)
      Array.from(chat.children).forEach(child => resizeObserver?.observe(child))
    }
    observeChildren()

    return () => {
      mutationObserver?.disconnect()
      resizeObserver?.disconnect()
    }
  }, [scheduleAutoScroll])

  useEffect(() => {
    if (messages.length === 0) {
      if (scrollFrameRef.current != null) {
        window.cancelAnimationFrame(scrollFrameRef.current)
        scrollFrameRef.current = null
      }
      autoScrollRef.current = true
      if (showScrollBtnRef.current) {
        showScrollBtnRef.current = false
        setShowScrollBtn(false)
      }
      return
    }
    if (!autoScrollRef.current) return
    scheduleAutoScroll()
  }, [conclusions, messages, streamingRole, scheduleAutoScroll])

  /**
   * Scroll fires many times per frame, and reading the geometry forces a
   * layout every time — most expensive precisely while the chat is streaming
   * and the DOM keeps changing under it. One measurement per frame is all the
   * button needs, and it is what keeps the wheel smooth across the threshold.
   */
  const handleChatScroll = useCallback(() => {
    if (scrollProbeRef.current != null) return
    scrollProbeRef.current = window.requestAnimationFrame(() => {
      scrollProbeRef.current = null
      const chat = chatRef.current
      if (!chat) return
      const distance = chat.scrollHeight - chat.scrollTop - chat.clientHeight
      autoScrollRef.current = distance < FOLLOW_DISTANCE_PX
      const shown = showScrollBtnRef.current
      const next = shown ? distance >= FOLLOW_DISTANCE_PX : distance >= SHOW_BUTTON_DISTANCE_PX
      if (next !== shown) {
        showScrollBtnRef.current = next
        setShowScrollBtn(next)
      }
    })
  }, [])

  const scrollToBottom = useCallback(() => {
    autoScrollRef.current = true
    showScrollBtnRef.current = false
    setShowScrollBtn(false)
    // The animation owns the scroll position for its duration. An auto-scroll
    // jump landing in the middle of it sets scrollTop outright, which reads as
    // the scroll snagging halfway down.
    smoothScrollUntilRef.current = performance.now() + SMOOTH_SCROLL_MS
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  return {
    bottomRef,
    chatRef,
    headerTopRef,
    summaryPanelRef,
    inputAreaRef,
    headerBodyHeight,
    showScrollBtn,
    isWideLayout,
    handleChatScroll,
    scrollToBottom,
  }
}
