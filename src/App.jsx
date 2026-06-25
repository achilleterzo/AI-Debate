import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import ReactSelect from 'react-select'
import { Data } from './data/Data'
import { Session } from './data/Session'
import { Storage } from './data/Storage'
import { AI, useAIModels } from './services/AI'
import { Web } from './services/Web'
import { Document } from './data/Document'
import { markedInline } from './utils/Markdown'
import ChatTimeline from './components/ChatTimeline'
import ConfirmModalView from './components/ConfirmModal'
import ConstraintModalView from './components/ConstraintModal'
import DotsView from './components/Dots'
import DropdownItem from './components/DropdownItem'
import EndpointModalView from './components/EndpointModal'
import PayloadModalView from './components/PayloadModal'
import PromptSettingsModalView from './components/PromptSettingsModal'
import TopMenu from './components/TopMenu'
import ParticipantsPanel from './components/ParticipantsPanel'
import UserInputBoxView from './components/UserInputBox'
import { UI_LANGUAGE_OPTIONS as LANGUAGES } from './i18n/UiStrings'
import { PALETTE } from './dataset/Palette'
import { MOODS, MOOD_OPTIONS } from './prompts/Moods'
import { RESPONSE_LENGTHS } from './prompts/ResponseLengths'
import { CHARACTER_TYPES } from './dataset/CharacterTypes'
import { EDUCATION_LEVELS } from './prompts/EducationLevels'
import { MOOD_INTENSITY } from './prompts/MoodIntensity'
import { AGE_GROUPS } from './prompts/AgeGroups'
import { UI_STRINGS } from './i18n/UiStrings'
import { DEFAULT_GENERAL_PERSONALITY_INSTRUCTIONS } from './prompts/DefaultGeneralPersonalityInstructions'
import { DEBUG_MODE_STORAGE_KEY, DEFAULT_DYNAMIC_AFFINITY, DEFAULT_MAX_TURNS, DEFAULT_MODERATION_COOLING, DEFAULT_RECENT_K, DEFAULT_SUMMARY_ACCUMULATE, DEFAULT_SUMMARY_ACCUMULATE_THRESHOLD, DEFAULT_SUMMARY_MODEL_ENABLED, DEFAULT_SUMMARY_MODEL_OVERRIDE, DEFAULT_SUMMARIZE_ATTACHMENTS, DEFAULT_TIMEOUT_SEC, DEFAULT_URL, DEFAULT_USE_SUMMARY, MODERATION_COOLING_STEPS, normalizeModerationCooling, SUMMARY_ACCUMULATE_STEPS } from './settings/Settings'
import { formatMoodOption, GlobalStyles, modelSelectStyles, moodSelectStyles, styles } from './components/Style'
import { Debate } from './debate/Debate'
import { streamChat } from './debate/Stream'
import { useDebateController } from './debate/DebateController'
import { CONCLUSION_TYPES } from './prompts/ConclusionTypes'

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const common = UI_STRINGS.common
  const ui = UI_STRINGS.app
  const topMenuUi = UI_STRINGS.topMenu
  // ── load saved settings ──
  const saved = Storage.loadSettings()

  // ── endpoint ──
  const [endpointInput, setEndpointInput] = useState(saved?.baseUrl ?? DEFAULT_URL)
  const [baseUrl, setBaseUrl] = useState(saved?.baseUrl ?? DEFAULT_URL)
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState(null)
  const [ollamaOk, setOllamaOk] = useState(null)

  // ── models ──
  const [models, setModels] = useState([])
  const [participants, setParticipants] = useState(() => {
    if (saved?.participants?.length >= 2) {
      return Debate.hydrateParticipantsFromSession(saved.participants)
    }
    return [Debate.mkParticipant(0, ''), Debate.mkParticipant(1, '')]
  })
  const [headerOpen, setHeaderOpen] = useState(true)

  // ── conversation ──
  const [topic, setTopic] = useState('')
  const topicRef = useRef('')   // uncontrolled mirror for the textarea — avoids re-render on every key
  const textareaRef = useRef(null)
  // Sync state (used for UI/buttons) only when needed, not on every keystroke
  const flushTopic = useCallback(() => {
    const v = topicRef.current
    setTopic(v)
    return v
  }, [])
  const setTopicValue = useCallback((v) => {
    topicRef.current = v
    if (textareaRef.current) textareaRef.current.value = v
    setTopic(v)
  }, [])
  const [topicDropOpen, setTopicDropOpen] = useState(false)
  const [topicHistory, setTopicHistory] = useState(Storage.loadTopics)
  const topicWrapRef = useRef(null)
  const [globalConstraints, setGlobalConstraints] = useState(() => saved?.globalConstraints ?? [])
  const [globalConstraintHistory, setGlobalConstraintHistory] = useState(Storage.loadGlobalConstraintsHistory)
  const [generalPersonalityInstructions, setGeneralPersonalityInstructions] = useState(() => saved?.generalPersonalityInstructions ?? DEFAULT_GENERAL_PERSONALITY_INSTRUCTIONS)
  // ── documents attached to topic ──
  const [attachedDocs, setAttachedDocs] = useState([]) // [{ name, content, truncated }]
  const docInputRef = useRef(null)
  const [maxTurns, setMaxTurns] = useState(saved?.maxTurns ?? DEFAULT_MAX_TURNS)
  const [recentK, setRecentK] = useState(saved?.recentK ?? DEFAULT_RECENT_K)
  const [useSummary, setUseSummary] = useState(saved?.useSummary ?? DEFAULT_USE_SUMMARY)
  const [dynamicAffinity, setDynamicAffinity] = useState(saved?.dynamicAffinity ?? DEFAULT_DYNAMIC_AFFINITY)
  const [moderationCooling, setModerationCooling] = useState(() => normalizeModerationCooling(saved?.moderationCooling ?? DEFAULT_MODERATION_COOLING))
  const [summaryModelEnabled, setSummaryModelEnabled] = useState(saved?.summaryModelEnabled ?? DEFAULT_SUMMARY_MODEL_ENABLED)
  const [summaryModelOverride, setSummaryModelOverride] = useState(saved?.summaryModelOverride ?? DEFAULT_SUMMARY_MODEL_OVERRIDE)
  const [summaryAccumulate, setSummaryAccumulate] = useState(saved?.summaryAccumulate ?? DEFAULT_SUMMARY_ACCUMULATE)
  const [summaryAccumulateThreshold, setSummaryAccumulateThreshold] = useState(saved?.summaryAccumulateThreshold ?? DEFAULT_SUMMARY_ACCUMULATE_THRESHOLD)
  const [summarizeAttachments, setSummarizeAttachments] = useState(saved?.summarizeAttachments ?? DEFAULT_SUMMARIZE_ATTACHMENTS)
  const [debugMode, setDebugMode] = useState(() => localStorage.getItem(DEBUG_MODE_STORAGE_KEY) === 'true')
  const [uiLang, setUiLang] = useState(saved?.uiLang ?? Debate.detectBrowserLang())
  const [timeoutSec, setTimeoutSec] = useState(saved?.timeoutSec ?? DEFAULT_TIMEOUT_SEC)
  const [messages, setMessages] = useState([])
  const [running, setRunning] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [streamingRole, setStreamingRole] = useState(null)
  const [streamingSeq, setStreamingSeq] = useState(null)
  const [copiedIdx, setCopiedIdx] = useState(null)
  const [payloadModal, setPayloadModal] = useState(null)
  const [constraintModal, setConstraintModal] = useState(null)
  const [endpointModal, setEndpointModal] = useState(null)
  const [promptSettingsModal, setPromptSettingsModal] = useState(false)
  const [confirmModal, setConfirmModal] = useState(null)
  const [endpointStatusResults, setEndpointStatusResults] = useState({})
  const confirmActionRef = useRef(null)
  const [summary, setSummary] = useState('')
  const [summaryDebug, setSummaryDebug] = useState(null) // { payload, debugPayloads } from the latest summary
  const [summaryVisible, setSummaryVisible] = useState(false)
  const [summaryInProgress, setSummaryInProgress] = useState(false)
  const [lastPromptEstimate, setLastPromptEstimate] = useState(null) // { model, messageCount, totalChars, estimatedTokens }
  const [userInputPending, setUserInputPending] = useState(null) // { resolve, tag }
  const userInputRef = useRef('')

  // ── conclusions ──
  const [conclusions, setConclusions] = useState([])
  const [conclusionModel, setConclusionModel] = useState(saved?.conclusionModel ?? '')
  const [conclusionType, setConclusionType] = useState('summary')
  const [customConclusionPrompt, setCustomConclusionPrompt] = useState(saved?.customConclusionPrompt ?? '')
  const [standardConclusionPrompt, setStandardConclusionPrompt] = useState(saved?.standardConclusionPrompt ?? '')
  const [conclusionRunning, setConclusionRunning] = useState(false)
  // progressive conversation summary for conclusions (updated every round)
  const conclusionConvRef = useRef('') // text accumulated round by round, truncated to ~8000 chars

  const bottomRef = useRef(null)
  const chatRef = useRef(null)
  const headerTopRef = useRef(null)
  const summaryPanelRef = useRef(null)
  const inputAreaRef = useRef(null)
  const [headerBodyMaxHeight, setHeaderBodyMaxHeight] = useState(360)
  const autoScrollRef = useRef(true)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const showScrollBtnRef = useRef(false)
  const [is2xlLayout, setIs2xlLayout] = useState(() => (typeof window !== 'undefined' ? window.innerWidth >= 1536 : false))
  useEffect(() => { showScrollBtnRef.current = showScrollBtn }, [showScrollBtn])

  const {
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
  } = useDebateController({
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
    summaryAccumulate,
    summaryAccumulateThreshold,
  })

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1536px)')
    const apply = () => setIs2xlLayout(mql.matches)
    apply()
    mql.addEventListener('change', apply)
    return () => mql.removeEventListener('change', apply)
  }, [setHeaderBodyMaxHeight])

  const recomputeHeaderBodyMaxHeight = useCallback(() => {
    const vh = window.innerHeight || 0
    const headerTopH = headerTopRef.current?.offsetHeight ?? 0
    const inputH = inputAreaRef.current?.offsetHeight ?? 0
    const summaryPanelH = summaryPanelRef.current?.offsetHeight ?? 0
    const outerGutter = 20
    const next = Math.max(200, Math.floor(vh - headerTopH - inputH - summaryPanelH - outerGutter))
    setHeaderBodyMaxHeight(prev => (Math.abs(prev - next) < 2 ? prev : next))
  }, [])

  useEffect(() => {
    if (!headerOpen) return
    const schedule = () => window.requestAnimationFrame(recomputeHeaderBodyMaxHeight)
    schedule()
    const onResize = () => schedule()
    window.addEventListener('resize', onResize)

    let ro = null
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => schedule())
      if (headerTopRef.current) ro.observe(headerTopRef.current)
      if (summaryPanelRef.current) ro.observe(summaryPanelRef.current)
      if (inputAreaRef.current) ro.observe(inputAreaRef.current)
    }

    return () => {
      window.removeEventListener('resize', onResize)
      ro?.disconnect()
    }
  }, [headerOpen, summary, summaryVisible, recomputeHeaderBodyMaxHeight])

  const endpointSignature = useMemo(
    () => participants.map(p => `${p.id}|${p.model}|${(p.endpointOverride ?? '').trim()}`).join('::'),
    [participants],
  )

  const endpointStatuses = useMemo(() => {
    const active = participants
      .filter(p => p.model !== Debate.USER_MODEL && (p.endpointOverride ?? '').trim())
      .map(p => p.id)

    if (active.length === 0) return {}

    const next = {}
    for (const id of active) {
      next[id] = endpointStatusResults[id] ?? { state: 'checking' }
    }
    return next
  }, [participants, endpointStatusResults])

  useEffect(() => {
    let cancelled = false
    const active = participants
      .filter(p => p.model !== Debate.USER_MODEL && (p.endpointOverride ?? '').trim())
      .map(p => ({ id: p.id, url: (p.endpointOverride ?? '').trim().replace(/\/$/, '') }))

    if (active.length === 0) return

    ;(async () => {
      const out = {}
      await Promise.all(active.map(async (a) => {
        if (!/^https?:\/\//i.test(a.url)) {
          out[a.id] = { state: 'err' }
          return
        }
        try {
          const r = await fetch(`${a.url}/api/tags`, { signal: AbortSignal.timeout(5000) })
          out[a.id] = { state: r.ok ? 'ok' : 'err' }
        } catch {
          out[a.id] = { state: 'err' }
        }
      }))
      if (!cancelled) setEndpointStatusResults(out)
    })()

    return () => { cancelled = true }
  }, [endpointSignature, participants])

  // ── auto-save settings ─────────────────────────────────────────────────
  useEffect(() => {
    Storage.saveSettings({
      participants: Debate.serializeParticipantsForSession(participants),
      maxTurns,
      recentK,
      timeoutSec,
      baseUrl,
      useSummary,
      dynamicAffinity,
      moderationCooling,
      summaryModelEnabled,
      summaryModelOverride,
      summaryAccumulate,
      summaryAccumulateThreshold,
      summarizeAttachments,
      uiLang,
      conclusionModel,
      customConclusionPrompt: customConclusionPrompt ?? '',
      standardConclusionPrompt: standardConclusionPrompt ?? '',
      globalConstraints: globalConstraints ?? [],
      generalPersonalityInstructions: generalPersonalityInstructions ?? DEFAULT_GENERAL_PERSONALITY_INSTRUCTIONS,
    })
  }, [participants, maxTurns, recentK, timeoutSec, baseUrl, useSummary, dynamicAffinity, moderationCooling, summaryModelEnabled, summaryModelOverride, summaryAccumulate, summaryAccumulateThreshold, summarizeAttachments, uiLang, conclusionModel, customConclusionPrompt, standardConclusionPrompt, globalConstraints, generalPersonalityInstructions])

  useEffect(() => {
    if (!topicDropOpen) return
    const handler = (e) => { if (topicWrapRef.current && !topicWrapRef.current.contains(e.target)) setTopicDropOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [topicDropOpen])

  const { fetchModels } = useAIModels({
    defaultUrl: DEFAULT_URL,
    noLocalModelsMessage: ui.noLocalModels,
    setConnecting,
    setConnectError,
    setModels,
    setParticipants,
    setBaseUrl,
    setOllamaOk,
  })

  const defaultConclusionModel = Debate.pickOperationalModel(participants, summaryModelEnabled, summaryModelOverride)
  const effectiveConclusionModel = conclusionModel && models.includes(conclusionModel)
    ? conclusionModel
    : defaultConclusionModel

  // ── scroll ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (autoScrollRef.current) {
      const el = chatRef.current
      if (el) {
        el.scrollTop = el.scrollHeight
        if (showScrollBtnRef.current) {
          showScrollBtnRef.current = false
          setShowScrollBtn(false)
        }
      } else {
        bottomRef.current?.scrollIntoView({ behavior: 'auto' })
      }
    }
  }, [messages, streamingRole])

  const handleStart = () => {
    if (!topic.trim() || participants.some(p => !p.model)) return
    logLaunchEstimate('start')
    Storage.saveTopicToHistory(topic)
    setTopicHistory(Storage.loadTopics())
    setTopicDropOpen(false)
    interjectRef.current = null

    // If there are already messages (resume from snapshot) keep summary and turn
    const isResume = messages.length > 0
    if (isResume) {
      // summaryRef.current and turnRef.current were already restored on load
      setSummaryDebug(null)
      setSummaryInProgress(false)
      setHeaderOpen(false)
      startDebate({
        resumeMessages: messages,
        resumeRound: turnRef.current,
        resumeSummary: summaryRef.current,
        injectTopic: topic.trim(),
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
    startDebate({
      resumeMessages: null,
      resumeRound: null,
      resumeSummary: '',
      injectTopic: topic.trim(),
    })
    setTopicValue('')
  }

  const handleStop = () => stopDebate()

  const handleResume = () => {
    if (messages.length === 0) return
    logLaunchEstimate('resume')
    interjectRef.current = null
    const inject = topic.trim() || null
    setTopicValue('')
    const cleanMessages = messages.filter(m => m.role !== 'error')

    const currentRound = turnRef.current?.round ?? 0
    const effectiveLimit = roundLimitRef.current > 0 ? roundLimitRef.current : (maxTurns || 0)
    const limitReached = effectiveLimit > 0 && currentRound >= effectiveLimit
    if (limitReached) {
      roundLimitRef.current = currentRound + (maxTurns || 1)
    }
    startDebate({
      resumeMessages: cleanMessages,
      resumeRound: turnRef.current,
      resumeSummary: summaryRef.current,
      injectTopic: inject,
    })
  }

  const handleInterjection = () => {
    const text = topicRef.current.trim() || topic.trim()
    if (!text) return
    queueInterjection(text, () => setTopicValue(''))
  }

  const openConfirm = useCallback((state, onConfirm) => {
    confirmActionRef.current = onConfirm
    setConfirmModal(state)
  }, [])

  const handleConfirmModal = useCallback(() => {
    const fn = confirmActionRef.current
    confirmActionRef.current = null
    setConfirmModal(null)
    if (typeof fn === 'function') fn()
  }, [])

  const handleCancelConfirmModal = useCallback(() => {
    confirmActionRef.current = null
    setConfirmModal(null)
  }, [])

  const handleRequestRemoveParticipant = (idx) => {
    const p = participants[idx]
    const label = p?.name?.trim() || p?.tag || `#${idx + 1}`
    openConfirm(
      {
        title: ui.removeParticipantTitle,
        message: ui.removeParticipantMessage(label),
         confirmLabel: common.remove,
        danger: true,
      },
      () => {
        setParticipants(prev => Debate.reindexParticipants(prev.filter((_, i) => i !== idx)))
      },
    )
  }

  const handleConfigureParticipantEndpoint = (idx) => {
    const p = participants[idx]
    if (!p) return
    const label = p.name?.trim() ? `${p.name} (${p.tag})` : p.tag
    setEndpointModal({ idx, initialValue: p.endpointOverride ?? '', participantLabel: label })
  }

  const handleSaveParticipantEndpoint = (rawValue) => {
    if (!endpointModal) return
    const normalized = (rawValue ?? '').trim().replace(/\/$/, '')
    setParticipants(prev => prev.map((p, i) => i === endpointModal.idx ? { ...p, endpointOverride: normalized } : p))
    setEndpointModal(null)
  }

  const handleAddParticipantConstraint = (idx) => {
    const p = participants[idx]
    setConstraintModal({ mode: 'add', scope: 'participant', participantIdx: idx, participantTag: p?.tag ?? '' })
  }

  const handleEditParticipantConstraint = (idx, constraintIdx) => {
    const p = participants[idx]
    const initialText = p?.constraints?.[constraintIdx] ?? ''
    setConstraintModal({ mode: 'edit', scope: 'participant', participantIdx: idx, participantTag: p?.tag ?? '', constraintIdx, initialText })
  }

  const handleDeleteParticipantConstraint = (idx, constraintIdx) => {
    const p = participants[idx]
    const initialText = p?.constraints?.[constraintIdx] ?? ''
    setConstraintModal({ mode: 'delete', scope: 'participant', participantIdx: idx, participantTag: p?.tag ?? '', constraintIdx, initialText })
  }

  const handleAddGlobalConstraint = () => {
    setConstraintModal({ mode: 'add', scope: 'global', initialText: '' })
  }

  const handleEditGlobalConstraint = (constraintIdx) => {
    setConstraintModal({ mode: 'edit', scope: 'global', constraintIdx, initialText: globalConstraints[constraintIdx] ?? '' })
  }

  const handleDeleteGlobalConstraint = (constraintIdx) => {
    setConstraintModal({ mode: 'delete', scope: 'global', constraintIdx, initialText: globalConstraints[constraintIdx] ?? '' })
  }

  const handleDeleteGlobalSuggestion = (idx) => {
    const current = globalConstraintHistory[idx]
    if (!current) return
    openConfirm(
      {
        title: ui.removeConstraintHistoryTitle,
        message: ui.removeConstraintHistoryMessage(current),
         confirmLabel: common.remove,
        danger: true,
      },
      () => {
        const next = Storage.deleteGlobalConstraintFromHistoryByIndex(idx)
        setGlobalConstraintHistory(next)
      },
    )
  }

  const handleConstraintConfirm = (value) => {
    const modal = constraintModal
    if (!modal) return

    if (modal.scope === 'global') {
      if (modal.mode === 'delete') {
        setGlobalConstraints(prev => prev.filter((_, i) => i !== modal.constraintIdx))
      } else {
        const text = (value ?? '').trim()
        if (!text) return
        Storage.saveGlobalConstraintToHistory(text)
        setGlobalConstraintHistory(Storage.loadGlobalConstraintsHistory())
        if (modal.mode === 'add') {
          setGlobalConstraints(prev => prev.includes(text) ? prev : [...prev, text])
        } else if (modal.mode === 'edit') {
          setGlobalConstraints(prev => prev.map((c, i) => i === modal.constraintIdx ? text : c))
        }
      }
      setConstraintModal(null)
      return
    }

    if (modal.scope === 'participant') {
      if (modal.mode === 'delete') {
        setParticipants(prev => prev.map((p, i) => i === modal.participantIdx
          ? { ...p, constraints: (p.constraints ?? []).filter((_, j) => j !== modal.constraintIdx) }
          : p
        ))
      } else {
        const text = (value ?? '').trim()
        if (!text) return
        setParticipants(prev => prev.map((p, i) => {
          if (i !== modal.participantIdx) return p
          const list = [...(p.constraints ?? [])]
          if (modal.mode === 'add') {
            if (!list.includes(text)) list.push(text)
            return { ...p, constraints: list }
          }
          if (modal.mode === 'edit') {
            if (modal.constraintIdx == null || modal.constraintIdx < 0 || modal.constraintIdx >= list.length) return p
            list[modal.constraintIdx] = text
            return { ...p, constraints: list }
          }
          return p
        }))
      }
      setConstraintModal(null)
    }
  }
  const handleConclusion = async () => {
    const model = effectiveConclusionModel
    if (!model || conclusionRunning) return
    const type = conclusionType
    setConclusionRunning(true)
    const ct = CONCLUSION_TYPES.find(c => c.id === type)
    if (!ct) { setConclusionRunning(false); return }
    const customPrompt = (customConclusionPrompt || '').trim()
    const standardPrompt = (standardConclusionPrompt || '').trim()
    if (type === 'custom' && !customPrompt) { setConclusionRunning(false); return }
    const conv = conclusionConvRef.current ||
      Debate.buildConclusionConversation(messages, participants, {
        limit: Number.MAX_SAFE_INTEGER,
        messageLimit: Debate.CONCLUSION_MESSAGE_LIMIT,
      })
    const ctx = Debate.buildConclusionContext({
      conversation: conv,
      attachedDocs,
      conclusions,
      summary: summaryRef.current,
      type,
      model,
      customPrompt,
    })
    const finalConclusionPrompt = Debate.buildConclusionPrompt({
      conclusionType: ct,
      context: ctx,
      customPrompt,
      standardPrompt,
    })
    let result = ''
    try {
      await streamChat({
        baseUrl, model,
        messages: [{ ollamaRole: 'user', content: finalConclusionPrompt }],
        systemPrompt: `You are an expert analyst. Respond only with the requested ${ct.labelEn.toLowerCase()}, no preamble. Write in ${LANGUAGES.find(l => l.code === uiLang)?.label ?? uiLang} (language code: ${uiLang}). Never reveal chain-of-thought, planning notes, or meta-commentary (e.g., "the user is asking", "let me analyze"). Output final answer only.`,
        useTools: false,
        onEstimate: handlePromptEstimate,
        onToken: t => { result = t },
        timeoutMs: timeoutSec * 1000,
      })
      result = result.trim()
      if (Debate.shouldRewriteConclusionResult(result, uiLang)) {
        let cleaned = ''
        await streamChat({
          baseUrl,
          model,
          messages: [{
            ollamaRole: 'user',
            content: `Rewrite the following text into a clean final answer for "${ct.label}" in ${LANGUAGES.find(l => l.code === uiLang)?.label ?? uiLang} (language code: ${uiLang}).\n\nRules:\n- Remove all meta-reasoning, planning, and self-referential commentary.\n- Keep only the final content requested by the conclusion type.\n- No preamble.\n\nText to rewrite:\n${result}`,
          }],
          systemPrompt: `Return only the cleaned final answer in ${LANGUAGES.find(l => l.code === uiLang)?.label ?? uiLang}.`,
          useTools: false,
          onEstimate: handlePromptEstimate,
          onToken: t => { cleaned = t },
          timeoutMs: timeoutSec * 1000,
        })
        result = (cleaned || result).trim()
      }
      if (result) {
        const title = type === 'custom' ? customPrompt : ct.label
        setConclusions(prev => [...prev, { type, model, title, customPrompt: type === 'custom' ? customPrompt : null, content: result, createdAt: new Date().toISOString(), seq: nextSeq() }])
      }
    } catch (err) {
      console.warn('[conclusion] error:', err.message)
    }
    setConclusionRunning(false)
  }

  const handleConnect = () => {
    const url = endpointInput.trim().replace(/\/$/, '')
    if (!url) return
    fetchModels(url)
  }

  const allModelsSet = participants.length >= 2 && participants.every(p => p.model)
  const canStart  = topic.trim() && allModelsSet && !running && ollamaOk
  const canResume = messages.length > 0 && allModelsSet && !running && ollamaOk

  const handleOpenPromptSettings = () => {
    setPromptSettingsModal(true)
  }

  const handleSavePromptSettings = (text) => {
    setGeneralPersonalityInstructions(String(text || '').trim())
    setPromptSettingsModal(false)
  }

  const handleResetPromptSettings = useCallback(() => DEFAULT_GENERAL_PERSONALITY_INSTRUCTIONS, [])

  const handleResetAffinities = () => {
    if (running) return
    openConfirm(
      {
		title: ui.resetAffinitiesTitle,
        message: ui.resetAffinitiesMessage,
		confirmLabel: ui.resetAffinitiesConfirm,
        danger: false,
      },
      () => {
        setParticipants(prev => prev.map(p => ({ ...p, affinity: {}, affinityLocks: {} })))
      },
    )
  }

  const logLaunchEstimate = useCallback((mode) => {
    console.log('[context-estimate]', {
      mode,
      useSummary,
      summaryChars: contextEstimate.summaryChars,
      conversationChars: contextEstimate.convChars,
      effectiveChars: contextEstimate.baseChars,
      estimatedTokens: contextEstimate.estTokens,
      participants: participants.length,
      topicChars: (topic || '').length,
    })
  }, [contextEstimate, participants.length, topic, useSummary])

  const handlePromptEstimate = useCallback((info) => {
    setLastPromptEstimate(info)
  }, [])

  const handleSaveSnapshot = useCallback(() => {
    const snapshot = Session.buildSnapshotData({
      participants,
      globalConstraints,
      generalPersonalityInstructions,
      customConclusionPrompt,
      standardConclusionPrompt,
      maxTurns,
      recentK,
      timeoutSec,
      baseUrl,
      moderationCooling,
      summarizeAttachments,
      topic,
      messages,
      summary,
      turn: turnRef.current,
      conclusions,
      constants: Debate.sessionConstants(),
    })
    Session.downloadSnapshot(snapshot, { topic, messages })
  }, [participants, globalConstraints, generalPersonalityInstructions, customConclusionPrompt, standardConclusionPrompt, maxTurns, recentK, timeoutSec, baseUrl, moderationCooling, summarizeAttachments, topic, messages, summary, conclusions, turnRef])

  const handleLoadSnapshot = () => {
    Session.promptSnapshotFile({
      onData: (data) => {
          if (data.participants?.length >= 2) {
            setParticipants(Debate.hydrateParticipantsFromSession(data.participants))
          }
          if (Array.isArray(data.globalConstraints)) setGlobalConstraints(data.globalConstraints.filter(Boolean))
          if (typeof data.generalPersonalityInstructions === 'string') setGeneralPersonalityInstructions(data.generalPersonalityInstructions)
          if (typeof data.customConclusionPrompt === 'string') setCustomConclusionPrompt(data.customConclusionPrompt)
          if (typeof data.standardConclusionPrompt === 'string') setStandardConclusionPrompt(data.standardConclusionPrompt)
          if (data.maxTurns != null) setMaxTurns(data.maxTurns)
          if (data.recentK != null) setRecentK(data.recentK)
          if (data.timeoutSec != null) setTimeoutSec(data.timeoutSec)
          if (data.moderationCooling != null) {
            const v = Number(data.moderationCooling)
            if (Number.isFinite(v) && v > 0) setModerationCooling(Math.min(1, Math.max(0.01, v)))
          }
          if (data.useSummary != null) setUseSummary(data.useSummary)
          if (data.summarizeAttachments != null) setSummarizeAttachments(!!data.summarizeAttachments)
          if (data.baseUrl) { setBaseUrl(data.baseUrl); setEndpointInput(data.baseUrl) }
          if (data.version === 2) {
            if (data.topic) setTopicValue(data.topic)
            if (data.messages?.length) {
              const loaded = data.messages.filter(m => m.role === 'topic' || m.role === 'user' || m.role === 'interjection' || m.role === 'error' || (m.content && m.content.trim()))
              let s = 0
              const withSeq = loaded.map(m => m.seq != null ? (s = Math.max(s, m.seq), m) : { ...m, seq: ++s })
              seqRef.current = s
              setMessages(withSeq)
            }
            if (data.conclusions?.length) {
              const withSeq = data.conclusions.map(c => c.seq != null ? (seqRef.current = Math.max(seqRef.current, c.seq), c) : { ...c, seq: ++seqRef.current })
              setConclusions(withSeq)
            }
            if (data.summary) { summaryRef.current = data.summary; setSummary(data.summary) }
            if (data.turn) turnRef.current = data.turn
          }
      },
      onError: () => alert(ui.invalidJsonFile),
    })
  }

  const exportItems = useMemo(() => Session.createExportItems({
    labels: {
      html: topMenuUi.exportHtml,
      markdown: topMenuUi.exportMarkdown,
      json: topMenuUi.exportJson,
    },
    exporters: {
      html: Data.exportHTML,
      markdown: Data.exportMD,
      json: Data.exportJSON,
    },
    enabled: messages.some(m => m.role !== 'topic' && m.role !== 'error'),
    buildArgs: () => ({
      messages,
      participants,
      participantHistory,
      baseUrl,
      conclusions,
      summary,
      topic: (messages.find(m => m.role === 'topic')?.content || '').trim(),
      constants: {
        MOODS,
        MOOD_INTENSITY,
        DEFAULT_MOOD_INTENSITY: Debate.DEFAULT_MOOD_INTENSITY,
        AGE_GROUPS,
        DEFAULT_AGE_GROUP: Debate.DEFAULT_AGE_GROUP,
        EDUCATION_LEVELS,
        CHARACTER_TYPES,
        RESPONSE_LENGTHS,
      },
    }),
    onAfterExport: null,
  }), [messages, participants, participantHistory, baseUrl, conclusions, summary, topMenuUi.exportHtml, topMenuUi.exportMarkdown, topMenuUi.exportJson])

  const handleClearSettings = useCallback(() => {
    Session.requestClearSettings({
      openConfirm,
      title: 'Clear saved settings?',
      message: ui.clearSettingsMessage,
      confirmLabel: 'Delete',
      onConfirm: () => {
        Storage.clearSettings()
      },
    })
  }, [openConfirm, ui.clearSettingsMessage])

  return (
    <div className="h-screen w-full items-stretch 2xl:flex 2xl:flex-row" style={{ ...styles.app, flexDirection: is2xlLayout ? 'row' : 'column', alignItems: 'stretch' }}>
      <GlobalStyles />
      {/* ── left column: menu + participants ── */}
      <div className="relative z-10 w-full shrink-0 2xl:w-[800px]" style={{ width: is2xlLayout ? 800 : '100%', flexShrink: 0, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 10 }}>
      <div style={{ ...styles.header, borderRight: is2xlLayout ? '1px solid #2e2e2e' : 'none', height: is2xlLayout ? '100vh' : 'auto' }}>

        {/* hamburger | centered title | model status */}
        <div ref={headerTopRef} style={styles.headerTop}>

          {/* left: hamburger */}
          <TopMenu
            DropdownItem={DropdownItem}
            running={running}
            onSaveSnapshot={handleSaveSnapshot}
            onLoadSnapshot={handleLoadSnapshot}
            onOpenPromptSettings={handleOpenPromptSettings}
            exportItems={exportItems}
            onClearSettings={handleClearSettings}
          />

          {/* center: title */}
          <span style={{ ...styles.title, textAlign: 'center' }}>{ui.debateTitle}</span>

          {/* right: status + model count + accordion toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
            <div
              style={styles.dot(ollamaOk)}
              title={ollamaOk === null ? ui.connectionConnecting : ollamaOk ? ui.connectionConnected(models.length) : ui.connectionUnreachable}
            />
            {ollamaOk && <span style={styles.modelCount}>{ui.modelsCount(models.length)}</span>}
            {!is2xlLayout && (
              <button
                onClick={() => setHeaderOpen(v => !v)}
                 title={headerOpen ? ui.collapseSettings : ui.expandSettings}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 22, padding: '0 2px', lineHeight: 1, display: 'flex', alignItems: 'center' }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  {headerOpen ? <polyline points="18 15 12 9 6 15" /> : <polyline points="6 9 12 15 18 9" />}
                </svg>
              </button>
            )}
          </div>

        </div>

        {/* accordion: endpoint + participants + rounds */}
        <div style={{
          ...styles.headerBody,
          maxHeight: is2xlLayout ? 'none' : `${headerBodyMaxHeight}px`,
          display: (is2xlLayout || headerOpen) ? 'flex' : 'none',
          position: is2xlLayout ? 'relative' : 'absolute',
          left: is2xlLayout ? 'auto' : 0,
          right: is2xlLayout ? 'auto' : 0,
          top: is2xlLayout ? 'auto' : '100%',
          zIndex: is2xlLayout ? 'auto' : 130,
          background: '#1a1a1a',
          borderBottom: is2xlLayout ? 'none' : '1px solid #2e2e2e',
          boxShadow: is2xlLayout ? 'none' : '0 10px 24px #0009',
          flex: is2xlLayout ? 1 : 'none',
        }}>

        {/* configurazione endpoint */}
        <div style={styles.endpointRow}>
          <span style={styles.endpointLabel}>{ui.language}</span>
          <select
            value={uiLang}
            onChange={e => setUiLang(e.target.value)}
            disabled={running}
            style={{ background: '#1a1a1a', color: '#ccc', border: '1px solid #333', borderRadius: 6, padding: '4px 8px', fontSize: 12, cursor: running ? 'not-allowed' : 'pointer' }}
          >
            {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
          <span style={{ ...styles.endpointLabel, marginLeft: 8 }}>{ui.endpoint}</span>
          <input
            style={connectError ? styles.endpointInputErr : styles.endpointInput}
            value={endpointInput}
            onChange={e => setEndpointInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleConnect()}
            placeholder="http://localhost:11434"
            disabled={connecting || running}
            spellCheck={false}
          />
          <button
            style={styles.connectBtn(connecting)}
            onClick={handleConnect}
            disabled={connecting || running}
          >
            {connecting ? ui.connecting : ui.connect}
          </button>
          {connectError && <span style={styles.errText}>{connectError}</span>}
        </div>

        {/* participant selection */}
        <ParticipantsPanel
          participants={participants}
          running={running}
          setParticipants={setParticipants}
          userModel={Debate.USER_MODEL}
          characterTypes={CHARACTER_TYPES}
          responseLengths={RESPONSE_LENGTHS}
          modelSelectStyles={modelSelectStyles}
          moodSelectStyles={moodSelectStyles}
          moodOptions={MOOD_OPTIONS}
          formatMoodOption={formatMoodOption}
          moods={MOODS}
          moodIntensity={MOOD_INTENSITY}
          defaultMoodIntensity={Debate.DEFAULT_MOOD_INTENSITY}
          educationLevels={EDUCATION_LEVELS}
          ageGroups={AGE_GROUPS}
          defaultAgeGroup={Debate.DEFAULT_AGE_GROUP}
          models={models}
          palette={PALETTE}
          mkParticipant={Debate.mkParticipant}
          randomName={Debate.randomName}
          onResetAffinities={handleResetAffinities}
          onAddConstraint={handleAddParticipantConstraint}
          onEditConstraint={handleEditParticipantConstraint}
          onDeleteConstraint={handleDeleteParticipantConstraint}
          onRequestRemoveParticipant={handleRequestRemoveParticipant}
          onConfigureEndpoint={handleConfigureParticipantEndpoint}
          endpointStatuses={endpointStatuses}
        />

        <div style={{ marginTop: is2xlLayout ? 'auto' : 0 }}>
        {/* ── dynamic affinity row ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '6px 0 2px' }}>
          {/* dynamic affinity toggle */}
          <div
            onClick={() => !running && setDynamicAffinity(v => !v)}
            title={dynamicAffinity ? ui.dynamicAffinityTitleOn : ui.dynamicAffinityTitleOff}
            style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: running ? 'default' : 'pointer', userSelect: 'none', opacity: running ? 0.5 : 1 }}
          >
            <div style={{ width: 32, height: 16, borderRadius: 8, position: 'relative', background: dynamicAffinity ? '#22d3ee' : '#444', transition: 'background 0.2s', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: 2, left: dynamicAffinity ? 18 : 2, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
            </div>
            <span style={{ fontSize: 12, color: dynamicAffinity ? '#22d3ee' : '#666', whiteSpace: 'nowrap' }}>{ui.dynamicAffinity}</span>
          </div>
          {dynamicAffinity && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} title={ui.coolingTitle}>
              <span style={{ fontSize: 11, color: '#6aa7b5', whiteSpace: 'nowrap' }}>{ui.cooling}</span>
              {MODERATION_COOLING_STEPS.map(v => {
                const active = Math.abs(moderationCooling - v) < 0.0001
                return (
                  <button
                    key={String(v)}
                    disabled={running}
                    onClick={() => setModerationCooling(v)}
                    style={{
                      fontSize: 10, padding: '2px 6px', borderRadius: 4, border: '1px solid',
                      cursor: running ? 'default' : 'pointer',
                      background: active ? '#0f3640' : 'transparent',
                      borderColor: active ? '#22d3ee' : '#2a2a2a',
                      color: active ? '#22d3ee' : '#555',
                    }}
                  >{v.toFixed(2)}</button>
                )
              })}
            </div>
          )}
        </div>

        {/* ── summary row: per-round + accumulation + threshold ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '2px 0 2px' }}>
          {/* per-round summary toggle */}
          <div
            onClick={() => !running && setUseSummary(v => !v)}
            title={useSummary ? ui.perRoundSummaryOn : ui.perRoundSummaryOff}
            style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: running ? 'default' : 'pointer', userSelect: 'none', opacity: running ? 0.5 : 1 }}
          >
            <div style={{ width: 32, height: 16, borderRadius: 8, position: 'relative', background: useSummary ? '#4ade80' : '#444', transition: 'background 0.2s', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: 2, left: useSummary ? 18 : 2, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
            </div>
            <span style={{ fontSize: 12, color: useSummary ? '#4ade80' : '#666', whiteSpace: 'nowrap' }}>
              {useSummary ? ui.perRoundSummary : ui.perMessageSummary}
            </span>
          </div>
          {/* separatore visivo */}
          <div style={{ width: 1, height: 18, background: '#2e2e2e', flexShrink: 0 }} />
          {/* summarize attachments toggle */}
          <div
            onClick={() => !running && setSummarizeAttachments(v => !v)}
            title={summarizeAttachments
              ? 'Attachment summarization active: attached documents are analytically summarized first using the summary model'
              : 'Enable analytical summarization of attachments with the summary model'}
            style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: running ? 'default' : 'pointer', userSelect: 'none', opacity: running ? 0.5 : 1 }}
          >
            <div style={{ width: 32, height: 16, borderRadius: 8, position: 'relative', background: summarizeAttachments ? '#22d3ee' : '#444', transition: 'background 0.2s', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: 2, left: summarizeAttachments ? 18 : 2, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
            </div>
            <span style={{ fontSize: 12, color: summarizeAttachments ? '#22d3ee' : '#666', whiteSpace: 'nowrap' }}>{ui.summarizeAttachments}</span>
          </div>
          {/* accumulate summary toggle */}
          <div
            onClick={() => !running && setSummaryAccumulate(v => !v)}
            title={summaryAccumulate
              ? ui.accumulateSummaryOn(summaryAccumulateThreshold)
              : ui.accumulateSummaryOff(summaryAccumulateThreshold)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: running ? 'default' : 'pointer', userSelect: 'none', opacity: running ? 0.5 : 1 }}
          >
            <div style={{ width: 32, height: 16, borderRadius: 8, position: 'relative', background: summaryAccumulate ? '#a78bfa' : '#444', transition: 'background 0.2s', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: 2, left: summaryAccumulate ? 18 : 2, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
            </div>
            <span style={{ fontSize: 12, color: summaryAccumulate ? '#a78bfa' : '#666', whiteSpace: 'nowrap' }}>
              {summaryAccumulate ? ui.accumulateSummaryCompact(summaryAccumulateThreshold) : ui.accumulateSummary}
            </span>
          </div>
          {/* compaction threshold — pill buttons, visible only when accumulation is active */}
          {summaryAccumulate && (
            <div style={{ display: 'flex', gap: 3 }}>
              {SUMMARY_ACCUMULATE_STEPS.map(kb => {
                const active = summaryAccumulateThreshold === kb
                return (
                  <button key={kb}
                    disabled={running}
                    onClick={() => setSummaryAccumulateThreshold(kb)}
                    style={{
                      fontSize: 10, padding: '2px 6px', borderRadius: 4, border: '1px solid',
                      cursor: running ? 'default' : 'pointer',
                      background: active ? '#3b1f6e' : 'transparent',
                      borderColor: active ? '#a78bfa' : '#2a2a2a',
                      color: active ? '#a78bfa' : '#444',
                    }}
                  >{kb}K</button>
                )
              })}
            </div>
          )}
        </div>
        {/* ── summary row 2: model override ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 0 6px' }}>
          {/* toggle summary model */}
          <div
            onClick={() => !running && setSummaryModelEnabled(v => !v)}
            title={summaryModelEnabled ? 'Use dedicated model for summaries (click to disable)' : 'Enable dedicated model for summaries'}
            style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: running ? 'default' : 'pointer', userSelect: 'none', opacity: running ? 0.5 : 1 }}
          >
            <div style={{ width: 32, height: 16, borderRadius: 8, position: 'relative', background: summaryModelEnabled ? '#4a9eff' : '#444', transition: 'background 0.2s', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: 2, left: summaryModelEnabled ? 18 : 2, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
            </div>
            <span style={{ fontSize: 12, color: summaryModelEnabled ? '#4a9eff' : '#666', whiteSpace: 'nowrap' }}>{ui.summaryModel}</span>
          </div>
          {/* model select — always visible, disabled when toggle is off */}
          <div style={{ flex: 1 }}>
            <ReactSelect
              styles={modelSelectStyles}
              options={(() => {
                const cloud = models.filter(m => m.endsWith('cloud')).sort()
                const local = models.filter(m => !m.endsWith('cloud')).sort()
                return [
                  ...(cloud.length ? [{ label: 'Cloud', options: cloud.map(m => ({ value: m, label: m })) }] : []),
                  ...(local.length ? [{ label: 'Local', options: local.map(m => ({ value: m, label: m })) }] : []),
                ]
              })()}
              value={summaryModelOverride ? { value: summaryModelOverride, label: summaryModelOverride } : null}
              onChange={opt => setSummaryModelOverride(opt?.value ?? '')}
              placeholder={common.chooseModel}
              isClearable
              isDisabled={running || !summaryModelEnabled}
              menuPlacement="auto"
              noOptionsMessage={() => common.noModels}
            />
          </div>
        </div>

        {/* turni (round) + ultimi K + timeout + esporta */}
        <div style={{ ...styles.controlRow, flexWrap: 'wrap' }}>
          <span style={styles.label}>{ui.round}</span>
          <input
            type="number" min={0} style={styles.numInput}
            value={maxTurns}
            onChange={e => setMaxTurns(Number(e.target.value))}
            disabled={running}
          />
          <span style={styles.hint}>(0 = ∞)</span>
          <span style={{ ...styles.label, marginLeft: 8 }}>{ui.timeout}</span>
          <input
            type="number" min={10} max={600} style={styles.numInput}
            value={timeoutSec}
            onChange={e => setTimeoutSec(Math.max(10, Number(e.target.value)))}
            disabled={running}
          />
          <span style={styles.hint}>{ui.seconds}</span>
          <span style={{ ...styles.label, marginLeft: 8, opacity: useSummary ? 0.4 : 1 }}>{ui.lastK}</span>
          <input
            type="number" min={0} max={20} style={{ ...styles.numInput, opacity: useSummary ? 0.4 : 1 }}
            value={recentK}
            onChange={e => setRecentK(Math.max(0, Number(e.target.value)))}
            disabled={running || useSummary}
          />
          <div
            onClick={() => setDebugMode(v => { const next = !v; localStorage.setItem('debugMode', next); return next })}
            title={debugMode ? ui.debugOn : ui.debugOff}
            style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', cursor: 'pointer', userSelect: 'none' }}
          >
            <div style={{ width: 32, height: 16, borderRadius: 8, position: 'relative', background: debugMode ? '#f59e0b' : '#444', transition: 'background 0.2s' }}>
              <div style={{ position: 'absolute', top: 2, left: debugMode ? 18 : 2, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
            </div>
            <span style={{ fontSize: 12, color: debugMode ? '#f59e0b' : '#aaa' }}>{ui.debugLabel}</span>
          </div>
        </div>
	</div>
</div> {/* fine accordion */}
</div>
</div>

      {/* ── right column: summary + chat + prompt ── */}
      <div className="flex min-w-0 flex-1 flex-col" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: is2xlLayout ? '100vh' : 'auto', position: 'relative' }}>
      <div ref={summaryPanelRef} style={{
        borderBottom: '1px solid #2e2e2e',
        background: '#111',
      }}>
          <div
            role="button"
            tabIndex={0}
            onClick={() => setSummaryVisible(v => !v)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setSummaryVisible(v => !v)
              }
            }}
            style={{
              width: '100%', background: 'none', border: 'none',
              color: '#888', fontSize: 11, fontWeight: 600,
              padding: '6px 16px', cursor: 'pointer', textAlign: 'left',
              display: 'flex', alignItems: 'center', gap: 6,
              letterSpacing: 0.5, textTransform: 'uppercase',
            }}
          >
            <span style={{ color: streamingRole ? '#f97316' : '#555' }}>
              {streamingRole ? '⟳' : '◆'}
            </span>
            {ui.contextSummary}
            <span style={{ color: '#4a9eff', fontSize: 10, fontWeight: 600 }} title={ui.contextEstimate(contextEstimate.baseChars, contextEstimate.estTokens)}>
              ~{contextEstimate.estTokens} tok
            </span>
            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
              {summary && (
                <button
                  className="float-btn"
                  style={{ ...styles.floatBtn(false), position: 'static', opacity: 1 }}
                  title={ui.copySummary}
                  onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(summary) }}
                ><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="7" height="7" rx="1"/><path d="M3 8H2a1 1 0 01-1-1V2a1 1 0 011-1h5a1 1 0 011 1v1"/></svg></button>
              )}
              {debugMode && summaryDebug?.payload && (
                <button
                  className="float-btn"
                  style={{ ...styles.floatBtn(false), position: 'static', opacity: 1 }}
                  title={ui.inspectSummaryPayload}
                  onClick={e => {
                    e.stopPropagation()
                    const payloadBlock = summaryDebug.debugPayloads?.length > 1
                      ? { rounds: summaryDebug.debugPayloads }
                      : summaryDebug.payload
                    setPayloadModal({
                      payload: payloadBlock,
                      calls: summaryDebug.debugCalls ?? [],
                      affinity: summaryDebug.affinityDebug ?? null,
                    })
                  }}
                >⚙</button>
              )}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                {summaryVisible ? <polyline points="18 15 12 9 6 15" /> : <polyline points="6 9 12 15 18 9" />}
              </svg>
            </span>
          </div>
          {summaryVisible && (
            <div style={{
              padding: '8px 16px 12px',
              fontSize: 12, color: '#aaa', lineHeight: 1.6,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              borderTop: '1px solid #1e1e1e',
            }}>
              {summary || ui.noSummary}
            </div>
          )}
        </div>

      {/* ── messages ── */}
      <div
        ref={chatRef}
        style={{ ...styles.messages, position: 'relative' }}
        onScroll={() => {
          const el = chatRef.current
          if (!el) return
          const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
          const atBottom = distFromBottom < 80
          autoScrollRef.current = atBottom
          const nextShow = !atBottom
          if (showScrollBtnRef.current !== nextShow) {
            showScrollBtnRef.current = nextShow
            setShowScrollBtn(nextShow)
          }
        }}
      >
        <ChatTimeline
          messages={messages}
          running={running}
          conclusions={conclusions}
          conclusionTypes={CONCLUSION_TYPES}
          participants={participants}
          markedInline={markedInline}
          streamingRole={streamingRole}
          streamingSeq={streamingSeq}
          copiedIdx={copiedIdx}
          setCopiedIdx={setCopiedIdx}
          setConclusions={setConclusions}
          setPayloadModal={setPayloadModal}
          userModel={Debate.USER_MODEL}
          moods={MOODS}
          moodIntensity={MOOD_INTENSITY}
          defaultMoodIntensity={Debate.DEFAULT_MOOD_INTENSITY}
          DotsComponent={DotsView}
          onResume={handleResume}
          is2xlLayout={is2xlLayout}
        />
        {/* ── balloon feedback summary in progress ── */}
        {summaryInProgress && (
          <div style={{ textAlign: 'center', margin: '8px 16px' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              background: '#111820', border: '1px solid #4a9eff33',
              borderRadius: 20, padding: '8px 18px',
              fontSize: 12, color: '#4a9eff', opacity: 0.85,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4a9eff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, animation: 'spin 1s linear infinite' }}>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
              <span>{ui.summaryProcessing}</span>
            </div>
          </div>
        )}
        {conclusionRunning && (() => {
          const ct = CONCLUSION_TYPES.find(c => c.id === conclusionType) || { label: 'Conclusion', color: '#888' }
          const runningTitle = conclusionType === 'custom' ? (customConclusionPrompt.trim() || ct.label) : ct.label
          return (
            <div style={{ textAlign: 'center', margin: '8px 16px' }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                background: '#111820', border: `1px solid ${ct.color}33`,
                borderRadius: 20, padding: '8px 18px',
                fontSize: 12, color: ct.color, opacity: 0.85,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ct.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, animation: 'spin 1s linear infinite' }}>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
                <span>{ui.generatingConclusion(runningTitle)}</span>
              </div>
            </div>
          )
        })()}
        {/* ── conclusions generation panel ── */}
        {!running && !conclusionRunning && messages.some(m => !['topic','interjection','error'].includes(m.role) && m.content?.trim()) && (
          <div style={{ textAlign: 'center', margin: '12px 16px' }}>
            <div style={{
              display: 'inline-flex', flexDirection: 'column', gap: 10, alignItems: 'stretch',
              background: '#161620', border: '1px solid #2e2e2e', borderRadius: 12, padding: '14px 20px',
              width: '92%', maxWidth: 700, boxSizing: 'border-box',
            }}>
              <span style={{ color: '#666', fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>{ui.conclusions}</span>
              {/* tipo — pillarbox identico agli attori */}
              <div style={{ display: 'flex', gap: 6 }}>
                {CONCLUSION_TYPES.map(ct => {
                  const active = conclusionType === ct.id
                  return (
                    <button key={ct.id}
                      onClick={() => setConclusionType(ct.id)}
                      style={{
                        flex: 1, fontSize: 11, padding: '4px 0', borderRadius: 6, border: '1px solid',
                        cursor: 'pointer',
                        background: active ? `${ct.color}22` : 'transparent',
                        borderColor: active ? ct.color : '#2a2a2a',
                        color: active ? ct.color : '#555',
                        fontWeight: active ? 700 : 400,
                        transition: 'all 0.15s',
                      }}
                    >{ct.label}</button>
                  )
                })}
              </div>
              {conclusionType === 'custom' && (
                <textarea
                  value={customConclusionPrompt}
                  onChange={e => setCustomConclusionPrompt(e.target.value)}
                  placeholder={ui.customConclusionPlaceholder}
                  rows={3}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: '#0f0f0f', border: '1px solid #2e2e2e', borderRadius: 8,
                    color: '#ddd', fontSize: 12, lineHeight: 1.5, padding: '8px 10px', resize: 'vertical',
                  }}
                />
              )}
              {conclusionType !== 'custom' && (
                <textarea
                  value={standardConclusionPrompt}
                  onChange={e => setStandardConclusionPrompt(e.target.value)}
                  placeholder={ui.standardConclusionPlaceholder}
                  rows={2}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: '#0f0f0f', border: '1px solid #2e2e2e', borderRadius: 8,
                    color: '#ddd', fontSize: 12, lineHeight: 1.45, padding: '8px 10px', resize: 'vertical',
                  }}
                  title={ui.standardConclusionTitle}
                />
              )}
              {/* model + generate */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <ReactSelect
                    styles={modelSelectStyles}
                    options={(() => {
                      const cloud = models.filter(m => m.endsWith('cloud')).sort()
                      const local = models.filter(m => !m.endsWith('cloud')).sort()
                      return [
                        ...(cloud.length ? [{ label: 'Cloud', options: cloud.map(m => ({ value: m, label: m })) }] : []),
                        ...(local.length ? [{ label: 'Local', options: local.map(m => ({ value: m, label: m })) }] : []),
                      ]
                    })()}
                    value={effectiveConclusionModel ? { value: effectiveConclusionModel, label: effectiveConclusionModel } : null}
                    onChange={opt => setConclusionModel(opt?.value ?? '')}
                    placeholder={common.chooseModel}
                    isClearable
                    menuPlacement="top"
                    noOptionsMessage={() => common.noModels}
                  />
                </div>
                <button
                  disabled={!effectiveConclusionModel || conclusionRunning || (conclusionType === 'custom' && !customConclusionPrompt.trim())}
                  onClick={handleConclusion}
                  style={{
                    ...styles.connectBtn(!effectiveConclusionModel || conclusionRunning || (conclusionType === 'custom' && !customConclusionPrompt.trim())),
                    padding: '6px 18px', fontSize: 12, flexShrink: 0,
                    background: conclusionRunning ? '#222' : `${CONCLUSION_TYPES.find(c=>c.id===conclusionType)?.color}22`,
                    borderColor: `${CONCLUSION_TYPES.find(c=>c.id===conclusionType)?.color}66`,
                    color: conclusionRunning ? '#555' : CONCLUSION_TYPES.find(c=>c.id===conclusionType)?.color,
                  }}
                >{conclusionRunning ? '…' : ui.generate}</button>
              </div>
            </div>
          </div>
        )}
        {userInputPending && (
          <UserInputBoxView
            actor={participants.find(p => p.tag === userInputPending.tag)}
            onSend={txt => { if (txt) { userInputPending.resolve(txt); userInputRef.current = '' } }}
            onSkip={() => { userInputPending.resolve(null); userInputRef.current = '' }}
            userInputRef={userInputRef}
          />
        )}
        <div ref={bottomRef} />
        {showScrollBtn && (
          <div style={{ position: 'sticky', bottom: 16, display: 'flex', justifyContent: 'center', zIndex: 4, pointerEvents: 'none' }}>
            <button
              onClick={() => {
                autoScrollRef.current = true
                setShowScrollBtn(false)
                bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
              }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 44, height: 44, borderRadius: '50%',
                background: '#2a1010', border: '2px dashed #ef4444cc',
                boxShadow: 'inset 0 0 0 1px #ef444433, 0 8px 20px #000c', cursor: 'pointer',
                color: '#ef4444', pointerEvents: 'auto',
              }}
              title={ui.backToBottom}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4,6 8,10 12,6" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* ── input topic + controls ── */}
      <div
        ref={inputAreaRef}
        style={styles.inputArea}
        onDragOver={e => {
          if ([...e.dataTransfer.items].some(i => i.kind === 'file')) {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'copy'
          }
        }}
        onDrop={async e => {
          const files = [...e.dataTransfer.files].filter(f => /\.(txt|md|pdf)$/i.test(f.name))
          if (files.length === 0) return
          e.preventDefault()
          for (const file of files) {
            try {
              const doc = await Document.parse(file)
              setAttachedDocs(prev => {
                const filtered = prev.filter(d => d.name !== doc.name)
                return [...filtered, doc]
              })
            } catch (err) {
              console.error('Errore parsing documento:', err)
            }
          }
        }}
      >
        {/* ── column wrapper: chips above, controls row below ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 }}>
        {/* ── global constraints ── */}
        {globalConstraints.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {globalConstraints.map((constraint, ci) => (
              <div key={`gc-${ci}`} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: '#1f1726', border: '1px solid #4a2f63',
                borderRadius: 6, padding: '3px 8px', fontSize: 11, color: '#caa9ee',
                maxWidth: 420,
              }} title={constraint}>
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h4M3.5 6h5M4 8h4"/><rect x="1.5" y="1.5" width="9" height="9" rx="1.5"/>
                </svg>
                <button
                  onClick={() => handleEditGlobalConstraint(ci)}
                  style={{
                    background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0,
                    maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left',
                  }}
                  title={UI_STRINGS.participants.editConstraint}
                >
                  {constraint}
                </button>
                <button onClick={() => handleDeleteGlobalConstraint(ci)}
                  style={{ background: 'none', border: 'none', color: '#7f629d', cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1 }}>✕</button>
              </div>
            ))}
          </div>
        )}
        {/* ── attached documents ── */}
        {attachedDocs.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {attachedDocs.map((doc, di) => (
              <div key={di} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: '#1a1a2a', border: '1px solid #3a3a6a',
                borderRadius: 6, padding: '3px 8px', fontSize: 11, color: '#9090cc',
              }}>
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 2H3a1 1 0 00-1 1v7a1 1 0 001 1h6a1 1 0 001-1V5L7 2z"/><path d="M7 2v3h3"/>
                </svg>
                <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</span>
                {doc.truncated && <span style={{ color: '#aa7744', fontSize: 10 }} title={ui.docTruncated}>⚠</span>}
                <button onClick={() => setAttachedDocs(prev => prev.filter((_, j) => j !== di))}
                  style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1 }}>✕</button>
              </div>
            ))}
          </div>
        )}
        {/* ── row: topic input + buttons ── */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
        <div ref={topicWrapRef} style={{ position: 'relative', flex: 1, display: 'flex' }}>
        <textarea
          ref={textareaRef}
          style={{ ...styles.textarea, flex: 1 }}
          defaultValue={topic}
          onChange={e => {
            topicRef.current = e.target.value
            if (running) setTopic(e.target.value)
            if (e.target.value && topicDropOpen) setTopicDropOpen(false)
          }}
          onBlur={() => flushTopic()}
          onFocus={() => { if (messages.length === 0 && !running && topicHistory.length > 0 && !topicRef.current) setTopicDropOpen(true) }}
          onKeyDown={e => {
            if (e.key === 'Escape') { setTopicDropOpen(false); return }
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              const v = flushTopic()
              if (running && v.trim()) handleInterjection()
              else if (messages.length > 0 && !running) handleResume()
              else if (canStart) handleStart()
            }
          }}
          placeholder={
            running
              ? ui.topicQueued
              : messages.length > 0
                ? ui.topicContinue
                : ui.topicInitial
          }
          rows={1}
        />
        {/* topic history dropdown */}
        {topicDropOpen && messages.length === 0 && !running && topicHistory.length > 0 && (
          <div style={{
            position: 'absolute', bottom: '100%', left: 0, right: 0, zIndex: 200,
            background: '#1e1e1e', border: '1px solid #2e2e2e', borderRadius: 8,
            marginBottom: 4, boxShadow: '0 -4px 16px #0008', overflow: 'hidden',
          }}>
            {topicHistory.map((t, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 10px', borderBottom: i < topicHistory.length - 1 ? '1px solid #2a2a2a' : 'none',
                cursor: 'pointer',
              }}
                onMouseEnter={e => e.currentTarget.style.background = '#2a2a2a'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span
                  style={{ flex: 1, fontSize: 13, color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  onClick={() => { setTopicValue(t); setTopicDropOpen(false) }}
                >{t}</span>
                <button
                  onClick={e => {
                    e.stopPropagation()
                    const updated = topicHistory.filter((_, j) => j !== i)
                    Storage.overwriteTopics(updated)
                    setTopicHistory(updated)
                    if (updated.length === 0) setTopicDropOpen(false)
                  }}
                  style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 14, padding: '0 2px', lineHeight: 1, flexShrink: 0 }}
                  title={ui.removeHistoryItem}
                >✕</button>
              </div>
            ))}
          </div>
        )}
        </div>

        {/* ── attach document button ── */}
        <input
          ref={docInputRef}
          type="file"
          accept=".txt,.md,.pdf"
          multiple
          style={{ display: 'none' }}
          onChange={async e => {
            const files = Array.from(e.target.files || [])
            e.target.value = ''
            for (const file of files) {
              try {
                const doc = await Document.parse(file)
                setAttachedDocs(prev => {
                  // avoid duplicates by name
                  const filtered = prev.filter(d => d.name !== doc.name)
                  return [...filtered, doc]
                })
              } catch (err) {
                console.error('Errore parsing documento:', err)
              }
            }
          }}
        />
        <button
          title={ui.addGlobalConstraint}
          onClick={handleAddGlobalConstraint}
          style={{
            background: globalConstraints.length > 0 ? '#24192d' : '#161616',
            border: `1px solid ${globalConstraints.length > 0 ? '#6a3b87' : '#2e2e2e'}`,
            borderRadius: 8,
            width: 44,
            height: 44,
            padding: 0,
            cursor: 'pointer',
            color: globalConstraints.length > 0 ? '#caa9ee' : '#555',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0,
            position: 'relative',
            transition: 'all 0.15s',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 4h10M3 8h10M3 12h10"/>
            <circle cx="6" cy="4" r="1.4" fill="currentColor" stroke="none"/>
            <circle cx="10" cy="8" r="1.4" fill="currentColor" stroke="none"/>
            <circle cx="7" cy="12" r="1.4" fill="currentColor" stroke="none"/>
          </svg>
          {globalConstraints.length > 0 && (
            <span style={{
              position: 'absolute', top: -4, right: -4,
              minWidth: 16, height: 16, borderRadius: 999,
              background: '#6a3b87', border: '1px solid #8f5bb3',
              color: '#f3e8ff', fontSize: 10, lineHeight: '14px', fontWeight: 700,
              padding: '0 4px',
            }}>{globalConstraints.length}</span>
          )}
        </button>
        <button
          title={ui.attachDocument}
          onClick={() => docInputRef.current?.click()}
          style={{
            background: attachedDocs.length > 0 ? '#1a1a3a' : '#161616',
            border: `1px solid ${attachedDocs.length > 0 ? '#4a4aaa' : '#2e2e2e'}`,
            borderRadius: 8,
            width: 44,
            height: 44,
            padding: 0,
            cursor: 'pointer',
            color: attachedDocs.length > 0 ? '#8888dd' : '#555',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0,
            position: 'relative',
            transition: 'all 0.15s',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13.5 8.5l-5.5 5.5a4 4 0 01-5.657-5.657l6-6a2.5 2.5 0 013.535 3.536l-6.007 6a1 1 0 01-1.414-1.414l5.5-5.5"/>
          </svg>
          {attachedDocs.length > 0 && (
            <span style={{
              position: 'absolute', top: -4, right: -4,
              minWidth: 16, height: 16, borderRadius: 999,
              background: '#4a4aaa', border: '1px solid #6a6ad6',
              color: '#eef2ff', fontSize: 10, lineHeight: '14px', fontWeight: 700,
              padding: '0 4px',
            }}>{attachedDocs.length}</span>
          )}
        </button>

        {/* state: idle, no session */}
        {!running && messages.length === 0 && (
          <button style={{ ...styles.connectBtn(!canStart), minHeight: 44, alignSelf: 'stretch' }} onClick={handleStart} disabled={!canStart}>
            Avvia
          </button>
        )}

        {/* state: running */}
        {running && (
          <>
            <button
              style={{
                ...styles.connectBtn(false),
                minHeight: 44,
                alignSelf: 'stretch',
                background: '#334155',
                color: '#e0e0e0',
                cursor: 'pointer',
              }}
              onClick={() => {
                const txt = (topicRef.current || '').trim()
                if (!txt) {
                  textareaRef.current?.focus()
                  return
                }
                handleInterjection()
              }}
              title={ui.queueCurrentText}
            >
              {ui.intervene}
            </button>
            <button
              style={{ ...styles.connectBtn(stopping), minHeight: 44, alignSelf: 'stretch' }}
              onClick={handleStop}
              disabled={stopping}
            >
              {stopping ? 'In arresto…' : 'Stop'}
            </button>
          </>
        )}

        {/* state: idle, existing session */}
        {!running && messages.length > 0 && (
          <>
            <button
              style={{ ...styles.connectBtn(!canResume), minHeight: 44, alignSelf: 'stretch' }}
              onClick={handleResume}
              disabled={!canResume}
              title={
                !allModelsSet ? ui.allParticipantsNeedModel
                : !ollamaOk ? ui.ollamaUnreachable
                : topic.trim() ? ui.resumeWithInterjection
                : ui.resumePingPong
              }
            >
              {messages.some(m => m.role === 'error') ? ui.resume : topic.trim() ? ui.continueWithPrompt : ui.continue}
            </button>
            <button style={{ ...styles.connectBtn(false), minHeight: 44, alignSelf: 'stretch' }} onClick={() => { setMessages([]); setTopicValue(''); setSummary(''); setSummaryDebug(null); summaryRef.current = ''; setConclusions([]); seqRef.current = 0 }}>
              {ui.resetButton}
            </button>
          </>
        )}
        </div>{/* end controls row */}
        {lastPromptEstimate && (
          <div style={{
            marginTop: 4,
            alignSelf: 'flex-end',
            fontSize: 10,
            color: '#f59e0b',
            border: '1px solid #4a3a12',
            background: '#1f1a0d',
            borderRadius: 999,
            padding: '2px 8px',
            whiteSpace: 'nowrap',
          }} title={`Last prompt sent: ${lastPromptEstimate.totalChars} characters (~${lastPromptEstimate.estimatedTokens} tokens), ${lastPromptEstimate.messageCount} messages, model ${lastPromptEstimate.model}`}>
            Last request: ~{lastPromptEstimate.estimatedTokens} tok · {lastPromptEstimate.model}
          </div>
        )}
        </div>{/* end column wrapper */}
      </div>
      {payloadModal && <PayloadModalView payload={payloadModal} onClose={() => setPayloadModal(null)} />}
      {constraintModal && (
        <ConstraintModalView
          state={constraintModal}
          onClose={() => setConstraintModal(null)}
          onConfirm={handleConstraintConfirm}
          globalSuggestions={globalConstraintHistory}
          selectStyles={modelSelectStyles}
          onDeleteGlobalSuggestion={handleDeleteGlobalSuggestion}
        />
      )}
      {endpointModal && (
        <EndpointModalView
          state={endpointModal}
          onClose={() => setEndpointModal(null)}
          onConfirm={handleSaveParticipantEndpoint}
        />
      )}
      {promptSettingsModal && (
        <PromptSettingsModalView
          value={generalPersonalityInstructions}
          onClose={() => setPromptSettingsModal(false)}
          onSave={handleSavePromptSettings}
          onReset={handleResetPromptSettings}
        />
      )}
      {confirmModal && (
        <ConfirmModalView
          state={confirmModal}
          onCancel={handleCancelConfirmModal}
          onConfirm={handleConfirmModal}
        />
      )}
      </div>
    </div>
  )
}
