import { useCallback, useEffect, useRef, useState } from 'react'

export function useAppLayout({ messages, streamingRole, headerOpen, summary, summaryVisible }) {
  const bottomRef = useRef(null)
  const chatRef = useRef(null)
  const headerTopRef = useRef(null)
  const summaryPanelRef = useRef(null)
  const inputAreaRef = useRef(null)
  const autoScrollRef = useRef(true)
  const showScrollBtnRef = useRef(false)
  const [headerBodyMaxHeight, setHeaderBodyMaxHeight] = useState(360)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [is2xlLayout, setIs2xlLayout] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1536)

  useEffect(() => { showScrollBtnRef.current = showScrollBtn }, [showScrollBtn])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1536px)')
    const apply = () => setIs2xlLayout(mediaQuery.matches)
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
    if (!autoScrollRef.current) return
    const chat = chatRef.current
    if (chat) {
      chat.scrollTop = chat.scrollHeight
      if (showScrollBtnRef.current) {
        showScrollBtnRef.current = false
        setShowScrollBtn(false)
      }
      return
    }
    bottomRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [messages, streamingRole])

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
    is2xlLayout,
    handleChatScroll,
    scrollToBottom,
  }
}
