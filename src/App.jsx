import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { Data } from './data/Data'
import { Session } from './data/Session'
import { Storage } from './data/Storage'
import { AI, useAIModels } from './services/AI'
import { markedInline } from './utils/Markdown'
import ChatTimeline from './components/ChatTimeline'
import DotsView from './components/Dots'
import ParticipantsPanel from './components/ParticipantsPanel'
import UserInputBoxView from './components/UserInputBox'
import ConclusionsPanel from './components/ConclusionsPanel'
import AttachmentsChips from './components/AttachmentsChips'
import TopicComposer from './components/TopicComposer'
import GlobalConstraintsChips from './components/GlobalConstraintsChips'
import DebateModeSettings from './components/DebateModeSettings'
import AffinitySettings from './components/AffinitySettings'
import SummarySettings from './components/SummarySettings'
import SummaryPanel from './components/SummaryPanel'
import HeaderTop from './components/HeaderTop'
import InputActionButtons from './components/InputActionButtons'
import RoundsInput from './components/RoundsInput'
import AppModals from './components/AppModals'
import SplashScreen from './components/SplashScreen'
import DebateWizard from './components/DebateWizard'
import ScrollToBottomButton from './components/ScrollToBottomButton'
import SummaryProgressBadge from './components/SummaryProgressBadge'
import { PALETTE } from './dataset/Palette'
import { MOODS, MOOD_OPTIONS } from './prompts/Moods'
import { DEBATE_MODE_OPTIONS } from './prompts/Modes'
import { RESPONSE_LENGTHS } from './prompts/ResponseLengths'
import { CHARACTER_TYPES } from './dataset/CharacterTypes'
import { EDUCATION_LEVELS } from './prompts/EducationLevels'
import { MOOD_INTENSITY } from './prompts/MoodIntensity'
import { AGE_GROUPS } from './prompts/AgeGroups'
import { UiStringsProvider, useUiStrings } from './i18n/UiStringsContext'
import { DEFAULT_GENERAL_PERSONALITY_INSTRUCTIONS } from './prompts/DefaultGeneralPersonalityInstructions'
import { isCustomOutputLanguage } from './prompts/LanguagePrompt'
import { DEFAULT_URL } from './settings/Settings'
import { formatMoodOption, GlobalStyles, modelSelectStyles, moodSelectStyles, styles } from './components/Style'
import { Debate } from './debate/Debate'
import { useDebateController } from './debate/DebateController'
import { useSnapshots } from './hooks/useSnapshots'
import { useUpdateCheck } from './hooks/useUpdateCheck'
import { useMagicWand } from './hooks/useMagicWand'
import { useDebateWizard } from './hooks/useDebateWizard'
import { useConclusions } from './hooks/useConclusions'
import { SUMMARY_ENDPOINT_ID, useEndpointStatuses } from './hooks/useEndpointStatuses'
import { useAppLayout } from './hooks/useAppLayout'
import { useSplashScreen } from './hooks/useSplashScreen'
import { useTopicComposer } from './hooks/useTopicComposer'
import { useAppSettings, usePersistedAppSettings } from './hooks/useAppSettings'
import { useAttachments } from './hooks/useAttachments'
import { CONCLUSION_TYPES } from './prompts/ConclusionTypes'

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const settings = useAppSettings()
  return (
    <UiStringsProvider lang={settings.interfaceLang}>
      <AppInner settings={settings} />
    </UiStringsProvider>
  )
}

function resetUnlockedAffinities(participant) {
  const affinity = participant.affinity && typeof participant.affinity === 'object' ? participant.affinity : {}
  const locks = participant.affinityLocks && typeof participant.affinityLocks === 'object' ? participant.affinityLocks : {}
  return {
    ...participant,
    affinity: Object.fromEntries(Object.entries(affinity).filter(([id]) => !!locks[id])),
  }
}

function AppInner({ settings }) {
  const UI_STRINGS = useUiStrings()
  const common = UI_STRINGS.common
  const ui = UI_STRINGS.app
  const topMenuUi = UI_STRINGS.topMenu
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState(null)
  const [ollamaOk, setOllamaOk] = useState(null)

  // ── models ──
  const [models, setModels] = useState([])
  const [headerOpen, setHeaderOpen] = useState(true)

  // ── conversation ──
  const [globalConstraintHistory, setGlobalConstraintHistory] = useState(Storage.loadGlobalConstraintsHistory)
  const [endpointHistory, setEndpointHistory] = useState(Storage.loadEndpointHistory)
  const { attachedDocs, inputRef: docInputRef, addFiles, removeAttachment } = useAttachments()
  const {
    saved, endpointInput, setEndpointInput, baseUrl, setBaseUrl, participants, setParticipants,
    globalConstraints, setGlobalConstraints, generalPersonalityInstructions, setGeneralPersonalityInstructions, debateMode, setDebateMode,
    maxTurns, setMaxTurns, useSummary, setUseSummary,
    dynamicAffinity, setDynamicAffinity, randomTurnOrder, setRandomTurnOrder,
    moderationCooling, setModerationCooling,
    summaryModelEnabled, setSummaryModelEnabled,
    summaryModelOverride, setSummaryModelOverride,
    summaryEndpointOverride, setSummaryEndpointOverride,
    summaryAccumulateThreshold, setSummaryAccumulateThreshold,
    summarizeAttachments, setSummarizeAttachments, debugMode, setDebugMode, uiLang, setUiLang,
    interfaceLang, setInterfaceLang,
    timeoutSec, setTimeoutSec, defaultModel, setDefaultModel,
    enabledTools, setEnabledTools,
  } = settings
  // The overrides stay stored while the switch is off, so turning it back on
  // restores the previous choice; what the operations see is the gated value.
  const effectiveSummaryModelOverride = summaryModelEnabled ? summaryModelOverride : ''
  const effectiveSummaryEndpointOverride = summaryModelEnabled ? summaryEndpointOverride : ''
  const [messages, setMessages] = useState([])
  const [running, setRunning] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [streamingRole, setStreamingRole] = useState(null)
  const [streamingSeq, setStreamingSeq] = useState(null)
  const [copiedIdx, setCopiedIdx] = useState(null)
  const [payloadModal, setPayloadModal] = useState(null)
  const [constraintModal, setConstraintModal] = useState(null)
  const [endpointModal, setEndpointModal] = useState(null)
  const [customLangModal, setCustomLangModal] = useState(null)
  const [promptSettingsModal, setPromptSettingsModal] = useState(false)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [confirmModal, setConfirmModal] = useState(null)
  const confirmActionRef = useRef(null)
  const [summary, setSummary] = useState('')
  const [summaryDebug, setSummaryDebug] = useState(null) // { payload, debugPayloads } from the latest summary
  const [summaryVisible, setSummaryVisible] = useState(false)
  const [summaryInProgress, setSummaryInProgress] = useState(false)
  const conclusionsRef = useRef([])
  const [memory, setMemory] = useState([])
  const memoryRef = useRef([])
  const [lastPromptEstimate, setLastPromptEstimate] = useState(null) // { model, messageCount, totalChars, estimatedTokens }
  const [lastRequest, setLastRequest] = useState(null)
  const [userInputPending, setUserInputPending] = useState(null) // { resolve, tag }
  const userInputRef = useRef('')

  // Progressive conversation summary for conclusions, updated every round.
  const conclusionConvRef = useRef('') // text accumulated round by round, truncated to ~8000 chars

  const {
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
    timeoutSec,
    baseUrl,
    defaultModel,
    useSummary,
    attachedDocs,
    summarizeAttachments,
    summaryModelOverride: effectiveSummaryModelOverride,
    summaryEndpointOverride: effectiveSummaryEndpointOverride,
    uiLang,
    debugMode,
    dynamicAffinity,
    randomTurnOrder,
    moderationCooling,
    globalConstraints,
    generalPersonalityInstructions,
    debateMode,
    enabledTools,
    conclusionsRef,
    memoryRef,
    setMemory,
    setLastPromptEstimate,
    setLastRequest,
    setStopping,
    setRunning,
    setStreamingSeq,
    setStreamingRole,
    setUserInputPending,
    summaryAccumulateThreshold,
  })

  const {
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
  } = useTopicComposer({
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
    startDebate,
    queueInterjection,
    setMessages,
    setSummary,
    setSummaryDebug,
    setSummaryInProgress,
    setHeaderOpen,
  })

  const conclusionsState = useConclusions({
    initialModel: saved?.conclusionModel ?? '',
    initialCustomPrompt: saved?.customConclusionPrompt ?? '',
    initialStandardPrompt: saved?.standardConclusionPrompt ?? '',
    models,
    participants,
    summaryModelOverride: effectiveSummaryModelOverride,
    defaultModel,
    attachedDocs,
    messages,
    summaryRef,
    conversationRef: conclusionConvRef,
    baseUrl,
    uiLang,
    timeoutSec,
    debateMode,
    nextSeq,
    setLastPromptEstimate,
    setLastRequest,
  })
  const wand = useMagicWand({
    baseUrl,
    defaultModel,
    participants,
    summaryModelOverride: effectiveSummaryModelOverride,
    messages,
    topic,
    attachedDocs,
    summaryRef,
    uiLang,
    debateMode,
    timeoutSec,
    setLastPromptEstimate,
    setLastRequest,
    ollamaOk,
  })
  const wizard = useDebateWizard({
    baseUrl,
    defaultModel,
    participants,
    summaryModelOverride: effectiveSummaryModelOverride,
    timeoutSec,
    ollamaOk,
    setLastPromptEstimate,
    setLastRequest,
  })
  const {
    conclusions,
    setConclusions,
    customConclusionPrompt,
    setCustomConclusionPrompt,
    standardConclusionPrompt,
    setStandardConclusionPrompt,
  } = conclusionsState
  useEffect(() => {
    conclusionsRef.current = conclusions
  }, [conclusions])
  useEffect(() => {
    memoryRef.current = memory
  }, [memory])

  usePersistedAppSettings({ settings, conclusions: conclusionsState })

  const splash = useSplashScreen()
  // Nothing in the app works without a reachable endpoint, so an unreachable
  // one puts the connection modal on screen by itself instead of leaving a red
  // badge as the only clue. Derived rather than opened by an effect, and it
  // stays away once dismissed and while the welcome screen is up.
  const [connectionPromptDismissed, setConnectionPromptDismissed] = useState(false)
  const needsConnectionPrompt = ollamaOk === false && !connecting && !splash.visible && !connectionPromptDismissed
  const activeEndpointModal = endpointModal ?? (needsConnectionPrompt ? { target: 'main', initialValue: endpointInput ?? '' } : null)

  const handleCloseEndpointModal = () => {
    if (activeEndpointModal?.target === 'main') setConnectionPromptDismissed(true)
    setEndpointModal(null)
  }
  // The summary endpoint rides along with the participant ones so its button
  // gets the same reachability badge.
  const summaryEndpointTargets = useMemo(
    () => [{ id: SUMMARY_ENDPOINT_ID, url: effectiveSummaryEndpointOverride }],
    [effectiveSummaryEndpointOverride],
  )
  const endpointStatuses = useEndpointStatuses(participants, summaryEndpointTargets)
  const {
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
  } = useAppLayout({ messages, conclusions, streamingRole, headerOpen })

  const { fetchModels } = useAIModels({
    defaultUrl: DEFAULT_URL,
    noLocalModelsMessage: ui.noLocalModels,
    setConnecting,
    setConnectError,
    setModels,
    setBaseUrl,
    setOllamaOk,
  })

  const handleStop = () => stopDebate()

  const openConfirm = useCallback((state, onConfirm) => {
    confirmActionRef.current = onConfirm
    setConfirmModal(state)
  }, [])

  const handleConfirmModal = useCallback(option => {
    const fn = option?.action || confirmActionRef.current
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
    setEndpointModal({ target: 'participant', idx, initialValue: p.endpointOverride ?? '', participantLabel: label })
  }

  const handleConfigureCustomLang = idx => {
    const participant = participants[idx]
    if (!participant) return
    setCustomLangModal({ idx, initialValue: participant.reasoningLangCustom ?? '' })
  }

  /**
   * The wizard designs a whole table, so applying it swaps the roster and the
   * shared rules wholesale — a half-applied setup would mix two debates.
   */
  const handleWizardGenerate = async (config) => {
    const result = await wizard.generate(config)
    if (!result) return
    setDebateMode(config.debateMode)
    setUiLang(config.uiLang)
    setParticipants(Debate.reindexParticipants(result.participants))
    setGlobalConstraints(result.globalConstraints)
    setWizardOpen(false)
  }

  const handleConfigureOutputLang = () => {
    setCustomLangModal({
      target: 'output',
      initialValue: isCustomOutputLanguage(uiLang) ? uiLang : '',
      title: ui.outputLangCustomTitle,
    })
  }

  const handleSaveCustomLang = rawValue => {
    if (!customLangModal) return
    const value = (rawValue ?? '').trim()
    if (customLangModal.target === 'output') {
      // An empty entry would leave the debate with a language named "": the
      // language already selected stays instead.
      if (value) setUiLang(value)
      setCustomLangModal(null)
      return
    }
    setParticipants(prev => prev.map((p, i) => i === customLangModal.idx
      // An empty custom language would leave the selector claiming a language
      // that is not there, so it falls back to following the output language.
      ? { ...p, reasoningLangCustom: value, ...(value ? {} : { reasoningLang: '' }) }
      : p))
    setCustomLangModal(null)
  }

  const handleConfigureMainEndpoint = () => {
    setEndpointModal({ target: 'main', initialValue: endpointInput ?? '' })
  }

  const handleConfigureSummaryEndpoint = () => {
    setEndpointModal({
      target: 'summary',
      initialValue: summaryEndpointOverride ?? '',
      participantLabel: ui.contextSummary,
    })
  }

  const handleSaveEndpoint = (rawValue) => {
    if (!activeEndpointModal) return
    const normalized = (rawValue ?? '').trim().replace(/\/$/, '')
    if (normalized) setEndpointHistory(Storage.saveEndpointToHistory(normalized))
    if (activeEndpointModal.target === 'main') {
      // Connecting is the save here: the modal stays open so the refreshed
      // model list is what the default model gets picked from. Pinning it open
      // matters most for the auto-opened one, which would otherwise vanish the
      // moment the connection it exists to fix starts working.
      if (!normalized) return
      setEndpointInput(normalized)
      setEndpointModal({ target: 'main', initialValue: normalized })
      fetchModels(normalized)
      return
    }
    if (activeEndpointModal.target === 'summary') {
      setSummaryEndpointOverride(normalized)
    } else {
      setParticipants(prev => prev.map((p, i) => i === activeEndpointModal.idx ? { ...p, endpointOverride: normalized } : p))
    }
    setEndpointModal(null)
  }

  const handleAddParticipantConstraint = (idx) => {
    const p = participants[idx]
    setConstraintModal({ mode: 'add', scope: 'participant', participantIdx: idx, participantTag: p?.tag ?? '' })
  }

  const handleEditParticipantConstraint = (idx, constraintIdx) => {
    const p = participants[idx]
    const entry = p?.constraints?.[constraintIdx]
    const initialText = typeof entry === 'string' ? entry : entry?.text ?? ''
    const initialOverride = typeof entry === 'object' && !!entry?.override
    setConstraintModal({ mode: 'edit', scope: 'participant', participantIdx: idx, participantTag: p?.tag ?? '', constraintIdx, initialText, initialOverride })
  }

  const handleDeleteParticipantConstraint = (idx, constraintIdx) => {
    const p = participants[idx]
    const entry = p?.constraints?.[constraintIdx]
    const initialText = typeof entry === 'string' ? entry : entry?.text ?? ''
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

  const handleConstraintConfirm = (value, override = false) => {
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
          const list = Debate.normalizeParticipantConstraints(p.constraints)
          const entry = { text, override: !!override }
          if (modal.mode === 'add') {
            if (!list.some(c => c.text === text)) list.push(entry)
            return { ...p, constraints: list }
          }
          if (modal.mode === 'edit') {
            if (modal.constraintIdx == null || modal.constraintIdx < 0 || modal.constraintIdx >= list.length) return p
            list[modal.constraintIdx] = entry
            return { ...p, constraints: list }
          }
          return p
        }))
      }
      setConstraintModal(null)
    }
  }
  const resetChat = useCallback(() => {
    setMessages([])
    setTopicValue('')
    setSummary('')
    setSummaryDebug(null)
    summaryRef.current = ''
    setConclusions([])
    setMemory([])
    memoryRef.current = []
    seqRef.current = 0
    setParticipants(prev => prev.map(resetUnlockedAffinities))
  }, [setConclusions, setMemory, setMessages, setParticipants, setSummary, setSummaryDebug, setTopicValue, memoryRef, seqRef, summaryRef])

  const handleReset = () => {
    if (running) return
    openConfirm(
      {
        title: ui.resetChatTitle,
        message: ui.resetChatMessage,
        confirmLabel: ui.resetButton,
        danger: true,
      },
      () => resetChat(),
    )
  }

  const allModelsSet = participants.length >= 2 && participants.every(p => Debate.hasConfiguredModel(p, defaultModel))
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
        setParticipants(prev => prev.map(resetUnlockedAffinities))
      },
    )
  }

  const updateCheck = useUpdateCheck()

  const { handleSaveSnapshot, handleLoadSnapshot } = useSnapshots({
    state: {
      participants,
      globalConstraints,
      generalPersonalityInstructions,
      debateMode,
      customConclusionPrompt,
      standardConclusionPrompt,
      maxTurns,
        timeoutSec,
      baseUrl,
      moderationCooling,
      summarizeAttachments,
      topic,
      messages,
      summary,
      conclusions,
      memory,
    },
    actions: {
      setParticipants,
      setGlobalConstraints,
      setGeneralPersonalityInstructions,
      setDebateMode,
      setCustomConclusionPrompt,
      setStandardConclusionPrompt,
      setMaxTurns,
      setTimeoutSec,
      setModerationCooling,
      setUseSummary,
      setSummarizeAttachments,
      setBaseUrl,
      setEndpointInput,
      setMessages,
      setConclusions,
      setMemory,
      setSummary,
    },
    refs: { sequence: seqRef, summary: summaryRef, turn: turnRef },
    setTopicValue,
    invalidSnapshotMessage: ui.invalidJsonFile,
  })

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
       baseUrl,
       debateMode,
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
  }), [messages, participants, baseUrl, debateMode, conclusions, summary, topMenuUi.exportHtml, topMenuUi.exportMarkdown, topMenuUi.exportJson])

  const handleClearSettings = useCallback(() => {
    Session.requestClearSettings({
      openConfirm,
      title: ui.clearSettingsTitle,
      message: ui.clearSettingsMessage,
      confirmLabel: common.delete,
      onConfirm: () => {
        Storage.clearSettings()
      },
    })
  }, [openConfirm, ui.clearSettingsTitle, ui.clearSettingsMessage, common.delete])

  return (
    <div className="h-screen w-full items-stretch 2xl:flex 2xl:flex-row" style={{ ...styles.app, flexDirection: isWideLayout ? 'row' : 'column', alignItems: 'stretch' }}>
      <GlobalStyles />
      {splash.visible && (
        <SplashScreen
          showOnStartup={splash.showOnStartup}
          onShowOnStartupChange={splash.setShowOnStartup}
          onClose={splash.close}
        />
      )}
      {wizardOpen && (
        <DebateWizard
          wizard={wizard}
          onClose={() => { wizard.cancel(); setWizardOpen(false) }}
          onGenerate={handleWizardGenerate}
          debateMode={debateMode}
          debateModeOptions={DEBATE_MODE_OPTIONS}
          uiLang={uiLang}
          characterTypes={CHARACTER_TYPES}
          moodSelectStyles={moodSelectStyles}
        />
      )}
      {/* ── left column: menu + participants ── */}
      <div className="relative z-10 w-full shrink-0 2xl:w-[800px]" style={{ width: isWideLayout ? 800 : '100%', flexShrink: 0, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 10 }}>
      <div style={{ ...styles.header, borderRight: isWideLayout ? '1px solid #2e2e2e' : 'none', height: isWideLayout ? '100vh' : 'auto' }}>

        {/* hamburger | centered title | model status */}
        <HeaderTop
          headerTopRef={headerTopRef}
          running={running}
          onSaveSnapshot={handleSaveSnapshot}
          onLoadSnapshot={handleLoadSnapshot}
          onOpenPromptSettings={handleOpenPromptSettings}
          onOpenSplash={splash.open}
          onOpenWizard={() => setWizardOpen(true)}
          exportItems={exportItems}
          updateAvailable={updateCheck.updateAvailable}
          ollamaOk={ollamaOk}
          modelsCount={models.length}
          onOpenConnection={handleConfigureMainEndpoint}
          isWideLayout={isWideLayout}
          headerOpen={headerOpen}
          onToggleHeaderOpen={() => setHeaderOpen(v => !v)}
        />

        {/* accordion: endpoint + participants + rounds */}
        <div style={{
          ...styles.headerBody,
          // Single column: fixed band between the header bar and the prompt bar,
          // so the panel always reaches the prompt bar and scrolls internally.
          height: isWideLayout ? 'auto' : `${headerBodyHeight}px`,
          display: (isWideLayout || headerOpen) ? 'flex' : 'none',
          position: isWideLayout ? 'relative' : 'absolute',
          left: isWideLayout ? 'auto' : 0,
          right: isWideLayout ? 'auto' : 0,
          top: isWideLayout ? 'auto' : '100%',
          zIndex: isWideLayout ? 'auto' : 130,
          background: '#1a1a1a',
          borderBottom: isWideLayout ? 'none' : '1px solid #2e2e2e',
          boxShadow: isWideLayout ? 'none' : '0 10px 24px #0009',
          flex: isWideLayout ? 1 : 'none',
        }}>

        <DebateModeSettings
          disabled={running}
          debateMode={debateMode}
          onDebateModeChange={setDebateMode}
          debateModeOptions={DEBATE_MODE_OPTIONS}
        />

        <SummarySettings
          uiLang={uiLang}
          onUiLangChange={setUiLang}
          onConfigureCustomLang={handleConfigureOutputLang}
          moodSelectStyles={moodSelectStyles}
          useSummary={useSummary}
          onUseSummaryChange={setUseSummary}
          summarizeAttachments={summarizeAttachments}
          onSummarizeAttachmentsChange={setSummarizeAttachments}
          summaryAccumulateThreshold={summaryAccumulateThreshold}
          onSummaryAccumulateThresholdChange={setSummaryAccumulateThreshold}
          summaryModelEnabled={summaryModelEnabled}
          onSummaryModelEnabledChange={setSummaryModelEnabled}
          summaryModelOverride={summaryModelOverride}
          onSummaryModelOverrideChange={setSummaryModelOverride}
          models={models}
          running={running}
          defaultModel={defaultModel}
          summaryEndpointOverride={summaryEndpointOverride}
          summaryEndpointState={endpointStatuses[SUMMARY_ENDPOINT_ID]?.state ?? ''}
          onConfigureEndpoint={handleConfigureSummaryEndpoint}
        />

        <AffinitySettings
          randomTurnOrder={randomTurnOrder}
          onRandomTurnOrderChange={setRandomTurnOrder}
          dynamicAffinity={dynamicAffinity}
          onDynamicAffinityChange={setDynamicAffinity}
          moderationCooling={moderationCooling}
          onModerationCoolingChange={setModerationCooling}
          running={running}
        />

        {/* participant selection */}
        <ParticipantsPanel
          participants={participants}
          running={running}
          setParticipants={setParticipants}
          userModel={Debate.USER_MODEL}
          characterTypes={CHARACTER_TYPES}
          responseLengths={RESPONSE_LENGTHS}
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
          onResetAffinities={handleResetAffinities}
          onAddConstraint={handleAddParticipantConstraint}
          onEditConstraint={handleEditParticipantConstraint}
          onDeleteConstraint={handleDeleteParticipantConstraint}
          onRequestRemoveParticipant={handleRequestRemoveParticipant}
          onConfigureEndpoint={handleConfigureParticipantEndpoint}
          onConfigureCustomLang={handleConfigureCustomLang}
          endpointStatuses={endpointStatuses}
          wand={wand}
          defaultModel={defaultModel}
        />
</div> {/* end accordion */}
</div>
</div>

      {/* ── right column: summary + chat + prompt ── */}
      {/* minHeight:0 is what makes the chat scrollable in single-column mode:
          without it this flex child grows with its content inside a clipped
          100vh parent, so the chat never scrolls and the prompt bar is pushed
          out of view. */}
      <div className="flex min-w-0 flex-1 flex-col" style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', height: isWideLayout ? '100vh' : 'auto', position: 'relative' }}>
      <SummaryPanel
        panelRef={summaryPanelRef}
        streamingRole={streamingRole}
        contextEstimate={contextEstimate}
        summary={summary}
        summaryVisible={summaryVisible}
        onToggleVisible={() => setSummaryVisible(v => !v)}
        debugMode={debugMode}
        summaryDebug={summaryDebug}
        lastPromptEstimate={lastPromptEstimate}
        lastRequest={debugMode ? lastRequest : null}
        onInspectRequest={() => setPayloadModal(lastRequest)}
        memory={memory}
        onInspectMemory={() => setPayloadModal({
          title: UI_STRINGS.payloadModal.memoryTitle,
          payload: memory,
        })}
        onInspectPayload={() => {
          const payloadBlock = summaryDebug.debugPayloads?.length > 1
            ? { rounds: summaryDebug.debugPayloads }
            : summaryDebug.payload
          setPayloadModal({
            payload: payloadBlock,
            calls: summaryDebug.debugCalls ?? [],
            affinity: summaryDebug.affinityDebug ?? null,
          })
        }}
      />

      {/* ── messages ── */}
      <div
        ref={chatRef}
        style={{ ...styles.messages, position: 'relative' }}
        onScroll={handleChatScroll}
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
          DotsComponent={DotsView}
           onResume={() => handleResume()}
          isWideLayout={isWideLayout}
        />
        {summaryInProgress && <SummaryProgressBadge />}
        <ConclusionsPanel
          running={running}
          messages={messages}
          models={models}
          modelSelectStyles={modelSelectStyles}
          conclusions={conclusionsState}
          wand={wand}
        />
        {userInputPending && (
          <UserInputBoxView
            actor={participants.find(p => p.tag === userInputPending.tag)}
            onSend={txt => { if (txt) { userInputPending.resolve(txt); userInputRef.current = '' } }}
            onSkip={() => { userInputPending.resolve(null); userInputRef.current = '' }}
            userInputRef={userInputRef}
          />
        )}
        <div ref={bottomRef} />
        {showScrollBtn && <ScrollToBottomButton onClick={scrollToBottom} />}
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
          await addFiles(files)
        }}
      >
        {/* ── column wrapper: chips above, controls row below ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 }}>
        <GlobalConstraintsChips constraints={globalConstraints} onEdit={handleEditGlobalConstraint} onDelete={handleDeleteGlobalConstraint} />
        <AttachmentsChips attachments={attachedDocs} onRemove={removeAttachment} />
        {/* ── row: topic input + buttons ── */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
        <TopicComposer
          topic={topic}
          topicRef={topicRef}
          textareaRef={textareaRef}
          topicWrapRef={topicWrapRef}
          topicDropOpen={topicDropOpen}
          setTopicDropOpen={setTopicDropOpen}
          topicHistory={topicHistory}
          running={running}
          messages={messages}
          attachedDocs={attachedDocs}
          canStart={canStart}
          allModelsSet={allModelsSet}
          ollamaOk={ollamaOk}
          setTopic={setTopic}
          flushTopic={flushTopic}
          setTopicValue={setTopicValue}
          handleStart={handleStart}
          handleResume={handleResume}
          handleInterjection={handleInterjection}
          removeHistoryEntry={removeHistoryEntry}
          wand={wand}
        />

        <RoundsInput
          maxTurns={maxTurns}
          onMaxTurnsChange={setMaxTurns}
          running={running}
        />

        <InputActionButtons
          globalConstraints={globalConstraints}
          onAddGlobalConstraint={handleAddGlobalConstraint}
          attachedDocs={attachedDocs}
          docInputRef={docInputRef}
          onFilesSelected={addFiles}
          running={running}
          stopping={stopping}
          messages={messages}
          canStart={canStart}
          canResume={canResume}
          allModelsSet={allModelsSet}
          ollamaOk={ollamaOk}
          topic={topic}
          topicRef={topicRef}
          textareaRef={textareaRef}
          onStart={() => handleStart()}
          onStop={handleStop}
          onIntervene={handleInterjection}
          onResume={() => handleResume()}
          onReset={handleReset}
        />
        </div>{/* end controls row */}
        </div>{/* end column wrapper */}
      </div>
      <AppModals
        payloadModal={payloadModal?.reasoningSeq != null
          ? {
              ...payloadModal,
              text: messages.find(message => message.seq === payloadModal.reasoningSeq)?.thinking || '',
            }
          : payloadModal}
        onClosePayloadModal={() => setPayloadModal(null)}
        constraintModal={constraintModal}
        onCloseConstraintModal={() => setConstraintModal(null)}
        onConfirmConstraint={handleConstraintConfirm}
        globalConstraintHistory={globalConstraintHistory}
        onDeleteGlobalSuggestion={handleDeleteGlobalSuggestion}
        endpointModal={activeEndpointModal}
        onCloseEndpointModal={handleCloseEndpointModal}
        onConfirmEndpoint={handleSaveEndpoint}
        customLangModal={customLangModal}
        onCloseCustomLangModal={() => setCustomLangModal(null)}
        onConfirmCustomLang={handleSaveCustomLang}
        endpointHistory={endpointHistory}
        onDeleteEndpointHistoryEntry={entry => setEndpointHistory(Storage.deleteEndpointFromHistory(entry))}
        models={models}
        defaultModel={defaultModel}
        onDefaultModelChange={setDefaultModel}
        connecting={connecting}
        connectError={connectError}
        ollamaOk={ollamaOk}
        promptSettingsModal={promptSettingsModal}
        generalPersonalityInstructions={generalPersonalityInstructions}
        onClosePromptSettings={() => setPromptSettingsModal(false)}
        onSavePromptSettings={handleSavePromptSettings}
        onResetPromptSettings={handleResetPromptSettings}
        onClearSettings={handleClearSettings}
        interfaceLang={interfaceLang}
        onInterfaceLangChange={setInterfaceLang}
        confirmModal={confirmModal}
        onCancelConfirmModal={handleCancelConfirmModal}
        onConfirmModal={handleConfirmModal}
        updateCheck={updateCheck}
        timeoutSec={timeoutSec}
        onTimeoutSecChange={setTimeoutSec}
        debugMode={debugMode}
        onDebugModeChange={next => { localStorage.setItem('debugMode', next); setDebugMode(next) }}
        running={running}
        enabledTools={enabledTools}
        onEnabledToolsChange={setEnabledTools}
      />
      </div>
    </div>
  )
}
