import { useCallback, useEffect, useRef, useState } from 'react'
import { TWO_COLUMN_MIN_WIDTH } from '../settings/Settings'

export function useAppLayout({ messages, conclusions = [], streamingRole, headerOpen, summary, summaryVisible }) {
  const bottomRef = useRef(null)
  const chatRef = useRef(null)
  const headerTopRef = useRef(null)
  const summaryPanelRef = useRef(null)
  const inputAreaRef = useRef(null)
  const autoScrollRef = useRef(true)
  const scrollFrameRef = useRef(null)
  const showScrollBtnRef = useRef(false)
  const [headerBodyMaxHeight, setHeaderBodyMaxHeight] = useState(360)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [isWideLayout, setIsWideLayout] = useState(() => typeof window !== 'undefined' && window.innerWidth >= TWO_COLUMN_MIN_WIDTH)

  const scheduleAutoScroll = useCallback(() => {
    if (!autoScrollRef.current || scrollFrameRef.current != null) return
    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollFrameRef.current = null
      if (!autoScrollRef.current) return
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

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(min-width: ${TWO_COLUMN_MIN_WIDTH}px)`)
    const apply = () => setIsWideLayout(mediaQuery.matches)
    apply()
    mediaQuery.addEventListener('change', apply)
    return () => mediaQuery.removeEventListener('change', apply)
  }, [])

  const recomputeHeaderBodyMaxHeight = useCallback(() => {
    const viewportHeight = window.innerHeight || 0
    const headerTopHeight = headerTopRef.current?.offsetHeight ?? 0
    const inputHeight = inputAreaRef.current?.offsetHeight ?? 0
    const summaryPanelHeight = summaryPanelRef.current?.offsetHeight ?? 0
    const nextHeight = Math.max(200, Math.floor(viewportHeight - headerTopHeight - inputHeight - summaryPanelHeight - 20))
    setHeaderBodyMaxHeight(previous => Math.abs(previous - nextHeight) < 2 ? previous : nextHeight)
  }, [])

  useEffect(() => {
    if (!headerOpen) return
    const schedule = () => window.requestAnimationFrame(recomputeHeaderBodyMaxHeight)
    schedule()
    window.addEventListener('resize', schedule)

    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule)
    if (headerTopRef.current) observer?.observe(headerTopRef.current)
    if (summaryPanelRef.current) observer?.observe(summaryPanelRef.current)
    if (inputAreaRef.current) observer?.observe(inputAreaRef.current)

    return () => {
      window.removeEventListener('resize', schedule)
      observer?.disconnect()
    }
  }, [headerOpen, recomputeHeaderBodyMaxHeight, summary, summaryVisible])

  useEffect(() => {
    const chat = chatRef.current
    if (!chat) return undefined

    const mutationObserver = typeof MutationObserver === 'undefined' ? null : new MutationObserver(() => {
      Array.from(chat.children).forEach(child => resizeObserver?.observe(child))
      scheduleAutoScroll()
    })
    mutationObserver?.observe(chat, { childList: true, subtree: true, characterData: true })

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

  const handleChatScroll = useCallback(() => {
    const chat = chatRef.current
    if (!chat) return
    const atBottom = chat.scrollHeight - chat.scrollTop - chat.clientHeight < 80
    autoScrollRef.current = atBottom
    if (showScrollBtnRef.current !== !atBottom) {
      showScrollBtnRef.current = !atBottom
      setShowScrollBtn(!atBottom)
    }
  }, [])

  const scrollToBottom = useCallback(() => {
    autoScrollRef.current = true
    setShowScrollBtn(false)
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  return {
    bottomRef,
    chatRef,
    headerTopRef,
    summaryPanelRef,
    inputAreaRef,
    headerBodyMaxHeight,
    showScrollBtn,
    isWideLayout,
    handleChatScroll,
    scrollToBottom,
  }
}
