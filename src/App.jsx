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
import GlobalConstraintsMenu from './components/GlobalConstraintsMenu'
import DebateModeSettings from './components/DebateModeSettings'
import AffinitySettings from './components/AffinitySettings'
import SummarySettings from './components/SummarySettings'
import SummaryPanel from './components/SummaryPanel'
import HeaderTop from './components/HeaderTop'
import InputActionButtons from './components/InputActionButtons'
import RoundsInput from './components/RoundsInput'
import AppModals from './components/AppModals'
import SplashScreen from './components/SplashScreen'
import ImportNoticeModal from './components/ImportNoticeModal'
import DebateWizard from './components/DebateWizard'
import ScrollToBottomButton from './components/ScrollToBottomButton'
import SummaryProgressBadge from './components/SummaryProgressBadge'
import { PALETTE } from './dataset/Palette'
import { MOODS } from './prompts/Moods'
import { DEBATE_MODE_OPTIONS } from './prompts/Modes'
import { RESPONSE_LENGTHS } from './prompts/ResponseLengths'
import { CHARACTER_TYPES } from './dataset/CharacterTypes'
import { EDUCATION_LEVELS } from './prompts/EducationLevels'
import { MOOD_INTENSITY } from './prompts/MoodIntensity'
import { AGE_GROUPS } from './prompts/AgeGroups'
import { useUiStrings } from './i18n/UiStringsContext'
import { UiStringsProvider } from './i18n/UiStringsProvider'
import { DEFAULT_GENERAL_PERSONALITY_INSTRUCTIONS } from './prompts/DefaultGeneralPersonalityInstructions'
import { isCustomOutputLanguage } from './prompts/LanguagePrompt'
import { DEFAULT_URL } from './settings/Settings'
import { formatMoodOption, GlobalStyles, moodSelectStyles, styles } from './components/Style'
import { Debate } from './debate/Debate'
import { useDebateController } from './debate/DebateController'
import { useSnapshots } from './hooks/useSnapshots'
import { useUpdateCheck } from './hooks/useUpdateCheck'
import { useMagicWand } from './hooks/useMagicWand'
import { useDebateWizard } from './hooks/useDebateWizard'
import { useConclusions } from './hooks/useConclusions'
import { SUMMARY_ENDPOINT_ID, useEndpointStatuses } from './hooks/useEndpointStatuses'
import { useModelCapabilities } from './hooks/useModelCapabilities'
import { useAppLayout } from './hooks/useAppLayout'
import { useSplashScreen } from './hooks/useSplashScreen'
import { useTopicComposer } from './hooks/useTopicComposer'
import { useAppSettings, usePersistedAppSettings } from './hooks/useAppSettings'
import { useAttachments } from './hooks/useAttachments'
import { CONCLUSION_TYPES } from './prompts/ConclusionTypes'
import { setActiveProviderId } from './providers/index.js'
import { configureOllamaCloud } from './providers/ollamaCloud.js'
import { isImageFileName } from './services/Images'

// A provider not listed yet: one shared array, so the memos below stay put.
const NO_MODELS = []

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
  const localizedMoods = useMemo(
    () => MOODS.map(mood => ({
      ...mood,
      label: UI_STRINGS.moods[mood.id] ?? mood.id,
    })),
    [UI_STRINGS],
  )
  const localizedMoodOptions = useMemo(
    () => localizedMoods.map(mood => ({ value: mood.id, label: mood.label, emoji: mood.emoji })),
    [localizedMoods],
  )
  const localizedEducationLevels = useMemo(
    () => EDUCATION_LEVELS.map(level => ({
      ...level,
      label: UI_STRINGS.educationLevels[level.value ?? 'default'] ?? (level.value ?? 'default'),
    })),
    [UI_STRINGS],
  )
  const localizedAgeGroups = useMemo(
    () => AGE_GROUPS.map((group, index) => ({
      ...group,
      label: UI_STRINGS.ageGroups[index] ?? String(group.value),
    })),
    [UI_STRINGS],
  )
  const localizedCharacterTypes = useMemo(
    () => CHARACTER_TYPES.map(type => ({
      ...type,
      label: UI_STRINGS.characterTypes[type.value ?? 'default'] ?? (type.value ?? 'default'),
    })),
    [UI_STRINGS],
  )
  const localizedResponseLengths = useMemo(
    () => RESPONSE_LENGTHS.map(length => ({
      ...length,
      label: UI_STRINGS.responseLengths[length.value ?? 'default'] ?? (length.value ?? 'default'),
    })),
    [UI_STRINGS],
  )
  const localizedMoodIntensity = useMemo(
    () => MOOD_INTENSITY.map((level, index) => ({
      ...level,
      label: UI_STRINGS.moodIntensity[index] ?? String(level.value),
    })),
    [UI_STRINGS],
  )
  const localizedModeOptions = useMemo(
    () => DEBATE_MODE_OPTIONS.map(option => ({
      ...option,
      label: UI_STRINGS.modes[option.value] ?? option.value,
    })),
    [UI_STRINGS],
  )
  const common = UI_STRINGS.common
  const ui = UI_STRINGS.app
  const topMenuUi = UI_STRINGS.topMenu
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState(null)
  const [ollamaOk, setOllamaOk] = useState(null)

  // ── models ──
  // Everything each provider serves, keyed by provider. One map rather than a
  // list for the active provider plus a copy for the others: a listing that
  // answers after the user switched provider lands under the provider it came
  // from, instead of posing as the new provider's list and replacing its
  // default model with one it does not have.
  const [providerModels, setProviderModels] = useState(Storage.loadProviderModelCache)
  const [headerOpen, setHeaderOpen] = useState(true)

  // ── conversation ──
  const [globalConstraintHistory, setGlobalConstraintHistory] = useState(Storage.loadGlobalConstraintsHistory)
  const [endpointHistory, setEndpointHistory] = useState(Storage.loadEndpointHistory)
  const { attachedDocs, inputRef: docInputRef, addFiles, removeAttachment } = useAttachments()
  const {
    saved, endpointInput, setEndpointInput, baseUrl, setBaseUrl, providerId, setProviderId, participants, setParticipants,
    globalConstraints, setGlobalConstraints, generalPersonalityInstructions, setGeneralPersonalityInstructions, debateMode, setDebateMode,
    maxTurns, setMaxTurns, useSummary, setUseSummary,
    dynamicAffinity, setDynamicAffinity, randomTurnOrder, setRandomTurnOrder,
    moderationCooling, setModerationCooling,
    summaryModelEnabled, setSummaryModelEnabled,
    summaryModelOverride, setSummaryModelOverride,
    summaryProviderId, setSummaryProviderId,
    summaryEndpointOverride, setSummaryEndpointOverride,
    summaryAccumulateThreshold, setSummaryAccumulateThreshold,
    summarizeAttachments, setSummarizeAttachments, debugMode, setDebugMode,
    debugPayloadTurns, setDebugPayloadTurns, uiLang, setUiLang,
    interfaceLang, setInterfaceLang,
    timeoutSec, setTimeoutSec, defaultModel, setDefaultModel,
    disabledModels, setDisabledModels,
    providerModelSettings, setProviderModelSettings,
    defaultThinkingLevel, setDefaultThinkingLevel, providerDefaultThinkingLevels,
    enabledTools, setEnabledTools,
    searchApiKey, setSearchApiKey, pageBlockKb, setPageBlockKb, searchEngine, setSearchEngine,
  } = settings
  // The app runs off `models` below, which is this list minus what the
  // provider settings switched off.
  const availableModels = providerModels[providerId] ?? NO_MODELS
  useEffect(() => { Storage.saveProviderModelCache(providerModels) }, [providerModels])
  const models = useMemo(() => AI.orderModels(AI.keepEnabledModels(availableModels, disabledModels), { defaultModel }), [availableModels, defaultModel, disabledModels])
  useEffect(() => {
    if (availableModels.length > 0 && !models.includes(defaultModel)) setDefaultModel(models[0] ?? '')
  }, [availableModels, defaultModel, models, setDefaultModel])
  // The overrides stay stored while the switch is off, so turning it back on
  // restores the previous choice; what the operations see is the gated value.
  const effectiveSummaryModelOverride = summaryModelEnabled ? summaryModelOverride : ''
  const effectiveSummaryProviderId = summaryModelEnabled ? summaryProviderId : ''
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
  const [ollamaCloudHasSavedKey, setOllamaCloudHasSavedKey] = useState(false)

  useEffect(() => { setActiveProviderId(providerId) }, [providerId])
  useEffect(() => {
    let cancelled = false
    window.desktop?.hasOllamaCloudApiKey?.().then(stored => {
      if (cancelled) return
      configureOllamaCloud({ stored })
      setOllamaCloudHasSavedKey(stored)
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [])

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
    forceStopDebate,
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
    defaultProviderId: providerId,
    defaultModel,
    defaultThinkingLevel,
    providerThinkingLevels: providerDefaultThinkingLevels,
    useSummary,
    attachedDocs,
    summarizeAttachments,
    summaryModelOverride: effectiveSummaryModelOverride,
    summaryProviderId: effectiveSummaryProviderId,
    summaryEndpointOverride: effectiveSummaryEndpointOverride,
    uiLang,
    debugMode,
    debugPayloadTurns,
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

  // Set when the chat is forked and consumed by the next start, which must not
  // treat an empty transcript as a reason to discard the branch's summary and
  // caches.
  const forkedRef = useRef(false)

  const {
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
  } = useTopicComposer({
    participants,
    defaultModel,
    defaultProviderId: providerId,
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
  })

  const conclusionsState = useConclusions({
    initialCustomPrompt: saved?.customConclusionPrompt ?? '',
    // The singular key is what older settings and snapshots carry: one string
    // shared by every type, which the hook spreads across all of them.
    initialStandardPrompts: saved?.standardConclusionPrompts ?? saved?.standardConclusionPrompt ?? '',
    participants,
    summaryModelOverride: effectiveSummaryModelOverride,
    summaryProviderId: effectiveSummaryProviderId,
    defaultProviderId: providerId,
    defaultModel,
    attachedDocs,
    messages,
    summaryRef,
    baseUrl,
    uiLang,
    timeoutSec,
    debateMode,
    summaryAccumulateThreshold,
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
    topicRef,
    attachedDocs,
    summaryRef,
    uiLang,
    debateMode,
    globalConstraints,
    enabledTools,
    timeoutSec,
    setLastPromptEstimate,
    setLastRequest,
    ollamaOk,
  })
  const wizard = useDebateWizard({
    baseUrl,
    defaultModel,
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
    standardConclusionPrompts,
    setStandardConclusionPrompt,
  } = conclusionsState
  useEffect(() => {
    conclusionsRef.current = conclusions
  }, [conclusions])
  useEffect(() => {
    memoryRef.current = memory
  }, [memory])

  usePersistedAppSettings({ settings, conclusions: conclusionsState })

  // Earlier versions kept the chat in progress in local storage. Serializing the
  // whole transcript while it streamed cost more than returning to it was worth,
  // so the chat lives only in memory now and the stale record is cleared out
  // instead of sitting in the quota forever. Snapshots are how a session is kept.
  useEffect(() => {
    Storage.purgeStoredChat()
  }, [])

  const splash = useSplashScreen()
  // Seeded once, like the splash: unticking the box inside the notice records
  // the choice for next time without closing what is still being read.
  const [showImportNotice, setShowImportNotice] = useState(Storage.loadShowImportNotice)
  const [importNoticeVisible, setImportNoticeVisible] = useState(false)

  const changeShowImportNotice = useCallback(next => {
    setShowImportNotice(next)
    Storage.saveShowImportNotice(next)
  }, [])

  const handleExportImported = useCallback(() => {
    if (showImportNotice) setImportNoticeVisible(true)
  }, [showImportNotice])

  // The stored flag and the state seeded from it have to move together, or the
  // notice would stay silent for the rest of the session despite being back on.
  const handleRestoreNotices = useCallback(() => {
    Storage.restoreNotices()
    setShowImportNotice(true)
  }, [])

  // Nothing in the app works without a reachable endpoint, so an unreachable
  // one puts the connection modal on screen by itself instead of leaving a red
  // badge as the only clue. Derived rather than opened by an effect, and it
  // stays away once dismissed and while the welcome screen is up.
  const [connectionPromptDismissed, setConnectionPromptDismissed] = useState(false)
  const needsConnectionPrompt = providerId === 'ollama' && ollamaOk === false && !connecting && !splash.visible && !connectionPromptDismissed
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
  const endpointStatuses = useEndpointStatuses(participants, summaryEndpointTargets, providerId)
  const modelCapabilities = useModelCapabilities(participants, baseUrl, defaultModel, providerId)
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

  const setProviderModelList = useCallback((list, selectedProvider) => {
    setProviderModels(previous => ({ ...previous, [selectedProvider]: list }))
  }, [])
  const { fetchModels } = useAIModels({
    providerId,
    providerAuth: providerId === 'ollama-cloud' ? String(ollamaCloudHasSavedKey) : '',
    baseUrl,
    noLocalModelsMessage: ui.noLocalModels,
    setConnecting,
    setConnectError,
    setModels: setProviderModelList,
    setBaseUrl,
    setOllamaOk,
  })
  // Providers listed afresh in this session. The persisted cache fills the
  // pickers straight after a reload, but it is not an answer from the provider:
  // the first request for each one still goes out.
  const [refreshedProviders, setRefreshedProviders] = useState(NO_MODELS)
  const loadProviderModels = useCallback(async (selectedProvider, force = false, endpoint = baseUrl) => {
    if (!force && providerModels[selectedProvider]?.length && refreshedProviders.includes(selectedProvider)) return providerModels[selectedProvider]
    try {
      const list = AI.orderModels(await AI.fetchModels(endpoint, { providerId: selectedProvider }))
      setRefreshedProviders(previous => previous.includes(selectedProvider) ? previous : [...previous, selectedProvider])
      setProviderModels(previous => ({ ...previous, [selectedProvider]: list }))
      return list
    } catch (error) {
      console.warn(`Unable to load ${selectedProvider} models:`, error.message)
      throw error
    }
  }, [baseUrl, providerModels, refreshedProviders])
  const participantProviderModels = useMemo(() => Object.fromEntries(Object.entries(providerModels).map(([selectedProvider, catalogue]) => {
    const config = providerModelSettings[selectedProvider] ?? {}
    return [selectedProvider, AI.orderModels(AI.keepEnabledModels(catalogue, config.disabledModels), { defaultModel: config.defaultModel })]
  })), [providerModelSettings, providerModels])
  const participantProviderSignature = useMemo(
    () => [...new Set(participants.map(participant => participant.providerId).filter(Boolean))].sort().join('|'),
    [participants],
  )
  useEffect(() => {
    if (!participantProviderSignature) return undefined
    const timer = window.setTimeout(() => {
      for (const selectedProvider of participantProviderSignature.split('|')) void loadProviderModels(selectedProvider).catch(() => undefined)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadProviderModels, participantProviderSignature])

  /**
   * A model switched off in the Ollama tab is dropped from the list the app
   * retrieves, so it can no longer be the general default either: every picker
   * resolves that default against the list it has just been removed from. The
   * selection moves to the first model still enabled rather than emptying —
   * losing the default is what puts the connection modal back on screen.
   */
  const handleToggleModelEnabled = useCallback((model, enabled) => {
    const rest = disabledModels.filter(entry => entry !== model)
    const nextDisabled = enabled ? rest : [...rest, model]
    setDisabledModels(nextDisabled)
    if (!enabled && defaultModel === model) {
      setDefaultModel(AI.firstEnabledModel(availableModels, nextDisabled))
    }
    if (!enabled) {
      const fallback = AI.firstEnabledModel(availableModels, nextDisabled)
      setParticipants(current => current.map(participant => (participant.providerId || providerId) === providerId && participant.model === model
        ? { ...participant, model: participant.providerId ? fallback : '' }
        : participant))
    }
  }, [availableModels, defaultModel, disabledModels, providerId, setDefaultModel, setDisabledModels, setParticipants])

  const handleSetAllModelsEnabled = useCallback(enabled => {
    setDisabledModels(enabled ? [] : [...availableModels])
    // Switching everything off leaves nothing to fall back to.
    if (!enabled) {
      setDefaultModel('')
      setParticipants(current => current.map(participant => !participant.localUser && participant.model !== Debate.USER_MODEL && (participant.providerId || providerId) === providerId && participant.model
        ? { ...participant, model: '' }
        : participant))
    }
  }, [availableModels, providerId, setDefaultModel, setDisabledModels, setParticipants])

  const handleStop = () => stopDebate()
  const handleForceStop = () => forceStopDebate()
  // Stable identity on purpose: the chat timeline is memoized, and an inline
  // arrow here re-rendered every message — markdown included — on any state
  // change in this component, which is what made the scroll stutter whenever
  // the back-to-bottom button appeared or went away.
  const handleResumeFromChat = useCallback(() => handleResume(), [handleResume])

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
    const selectedProvider = p.providerId || providerId
    setEndpointModal({ target: 'participant-provider', idx, providerId: selectedProvider, participantLabel: label })
    void loadProviderModels(selectedProvider).catch(() => undefined)
  }

  const handleConfigureCustomLang = idx => {
    const participant = participants[idx]
    if (!participant) return
    setCustomLangModal({ idx, initialValue: participant.reasoningLangCustom ?? '' })
  }

  /**
   * The wizard designs a whole table, so applying it swaps the roster and the
   * shared rules wholesale — a half-applied setup would mix two debates.
   *
   * That is also why it starts a new chat. A transcript belongs to the table
   * that produced it: messages carry participant tags, memory and conclusions
   * were written by people who are no longer seated, and the summary describes
   * a debate nobody at the new table took part in. Keeping any of it next to a
   * fresh roster is the mixing this function exists to prevent. The reset runs
   * first so that its affinity pass lands on the outgoing participants and the
   * new roster then replaces them outright.
   */
  const handleWizardGenerate = async (config) => {
    const result = await wizard.generate(config)
    if (!result) return
    resetChat()
    setDebateMode(config.debateMode)
    setUiLang(config.uiLang)
    setParticipants(Debate.reindexParticipants(result.participants))
    setGlobalConstraints(result.globalConstraints)
    // A proposal, not a decision: it lands in the composer, where the user
    // reads it and edits it before pressing start. `resetChat` above has just
    // cleared the box, so nothing written by hand is overwritten.
    if (result.topic) setTopicValue(result.topic)
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

  /**
   * The summary picks its model the way a participant does — provider first,
   * then one of that provider's models. It used to open the plain endpoint
   * editor, which only knew about an Ollama address and could not reach the
   * other providers at all.
   */
  const handleConfigureSummaryProvider = () => {
    const selectedProvider = summaryProviderId || providerId
    setEndpointModal({ target: 'summary-provider', providerId: selectedProvider })
    void loadProviderModels(selectedProvider).catch(() => undefined)
  }

  /**
   * Connect the general endpoint, outside the modal.
   *
   * The wizard's first step needs the same effects the modal's save produces —
   * remember the address, adopt it, refresh the model list — without the modal
   * being on screen to host them.
   */
  const connectMainEndpoint = (rawValue) => {
    const normalized = (rawValue ?? '').trim().replace(/\/$/, '')
    if (!normalized) return
    setEndpointHistory(Storage.saveEndpointToHistory(normalized))
    setEndpointInput(normalized)
    fetchModels(normalized)
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
    forkedRef.current = false
    setParticipants(prev => prev.map(resetUnlockedAffinities))
  }, [setConclusions, setMemory, setMessages, setParticipants, setSummary, setSummaryDebug, setTopicValue, forkedRef, memoryRef, seqRef, summaryRef])

  /**
   * Branch from the debate instead of ending it.
   *
   * Everything the branch earned survives - memory, conclusions, affinities,
   * the summary, the pages already fetched - and only the transcript goes. The
   * topic returns to the composer so it can be edited into the variation the
   * fork exists to try. `seqRef` is deliberately not reset: the conclusions
   * that stay keep their sequence numbers, and restarting the counter would
   * make new messages collide with them.
   */
  const forkChat = useCallback(() => {
    const previousTopic = [...messages].reverse().find(message => message.role === 'topic')?.content ?? ''
    setMessages([])
    setTopicValue(previousTopic)
    forkedRef.current = true
    textareaRef.current?.focus()
  }, [messages, setMessages, setTopicValue, forkedRef, textareaRef])

  const handleFork = () => {
    if (running || messages.length === 0) return
    openConfirm(
      {
        title: ui.forkChatTitle,
        message: ui.forkChatMessage,
        confirmLabel: ui.forkButton,
        danger: false,
      },
      () => forkChat(),
    )
  }

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

  const allModelsSet = participants.length >= 2 && participants.every(p => Debate.hasConfiguredModel(p, defaultModel, providerId))
  const canStart  = hasTopic && allModelsSet && !running && ollamaOk
  const canResume = messages.length > 0 && allModelsSet && !running && ollamaOk

  const handleOpenPromptSettings = () => {
    setPromptSettingsModal(true)
  }

  const handleProviderChange = useCallback(nextProvider => {
    if (nextProvider === providerId || running) return
    setProviderId(nextProvider)
    // The error on screen belongs to the provider being left.
    setConnectError(null)
    setParticipants(current => current.map(participant => participant.localUser || participant.providerId
      ? participant
      : { ...participant, model: '', endpointOverride: '' }))
    setSummaryModelOverride('')
    setSummaryEndpointOverride('')
  }, [providerId, running, setParticipants, setProviderId, setSummaryEndpointOverride, setSummaryModelOverride])

  const handleOllamaCloudConnect = useCallback(async apiKey => {
    const normalized = String(apiKey || '').trim()
    configureOllamaCloud(normalized ? { apiKey: normalized } : { stored: ollamaCloudHasSavedKey })
    const models = await fetchModels(baseUrl, 'ollama-cloud')
    if (models !== null && normalized) {
      try {
        if (window.desktop?.saveOllamaCloudApiKey) {
          await window.desktop.saveOllamaCloudApiKey(normalized)
          configureOllamaCloud({ stored: true })
          setOllamaCloudHasSavedKey(true)
        }
      } catch (error) { console.warn('Ollama Cloud key could not be persisted securely:', error.message) }
    } else if (ollamaCloudHasSavedKey) {
      configureOllamaCloud({ stored: true })
    }
    return models
  }, [baseUrl, fetchModels, ollamaCloudHasSavedKey])

  const updateProviderModelConfig = useCallback((selectedProvider, updater) => {
    setProviderModelSettings(previous => {
      const current = previous[selectedProvider] ?? { defaultModel: '', disabledModels: [] }
      return { ...previous, [selectedProvider]: updater(current) }
    })
  }, [setProviderModelSettings])

  const handleParticipantDialogProviderChange = useCallback(async selectedProvider => {
    if (!selectedProvider || endpointModal?.target !== 'participant-provider') return
    const idx = endpointModal.idx
    setEndpointModal(current => current?.target === 'participant-provider' ? { ...current, providerId: selectedProvider } : current)
    setParticipants(current => current.map((participant, index) => index === idx
      ? { ...participant, providerId: selectedProvider, model: '', endpointOverride: '' }
      : participant))
    try { await loadProviderModels(selectedProvider) } catch (error) { setConnectError(error.message) }
  }, [endpointModal, loadProviderModels, setParticipants])

  const handleParticipantDialogModelChange = useCallback(model => {
    if (endpointModal?.target !== 'participant-provider') return
    const idx = endpointModal.idx
    const selectedProvider = endpointModal.providerId
    setParticipants(current => current.map((participant, index) => index === idx
      ? { ...participant, providerId: selectedProvider, model }
      : participant))
  }, [endpointModal, setParticipants])

  const handleParticipantProviderConnect = useCallback(async rawValue => {
    const normalized = String(rawValue || '').trim().replace(/\/$/, '')
    if (!normalized) return []
    setConnecting(true)
    setConnectError(null)
    try {
      const list = await loadProviderModels('ollama', true, normalized)
      setEndpointHistory(Storage.saveEndpointToHistory(normalized))
      setEndpointInput(normalized)
      setBaseUrl(normalized)
      setOllamaOk(true)
      return list
    } catch (error) {
      setOllamaOk(false)
      setConnectError(error.message)
      throw error
    } finally { setConnecting(false) }
  }, [loadProviderModels, setBaseUrl, setEndpointInput])

  const handleParticipantCloudConnect = useCallback(async apiKey => {
    const normalized = String(apiKey || '').trim()
    configureOllamaCloud(normalized ? { apiKey: normalized } : { stored: ollamaCloudHasSavedKey })
    const list = await loadProviderModels('ollama-cloud', true)
    if (normalized && window.desktop?.saveOllamaCloudApiKey) {
      await window.desktop.saveOllamaCloudApiKey(normalized)
      configureOllamaCloud({ stored: true })
      setOllamaCloudHasSavedKey(true)
    }
    return list
  }, [loadProviderModels, ollamaCloudHasSavedKey])

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

  /**
   * Every participant back to the general provider.
   *
   * A model belongs to the provider it was picked on, and an endpoint override
   * to the address it was written for, so both go with the provider rather than
   * being left behind pointing at a provider the participant no longer uses.
   */
  const handleResetProviders = () => {
    if (running) return
    openConfirm(
      {
        title: ui.resetProvidersTitle,
        message: ui.resetProvidersMessage,
        confirmLabel: ui.resetProvidersConfirm,
        danger: false,
      },
      () => {
        setParticipants(prev => prev.map(participant => participant.providerId || participant.endpointOverride
          ? { ...participant, providerId: '', endpointOverride: '', model: participant.localUser || participant.model === Debate.USER_MODEL ? participant.model : '' }
          : participant))
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
      standardConclusionPrompts,
      maxTurns,
        timeoutSec,
      baseUrl,
      providerId,
      moderationCooling,
      summarizeAttachments,
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
      setProviderId,
      setMessages,
      setConclusions,
      setMemory,
      setSummary,
    },
    refs: { sequence: seqRef, summary: summaryRef, turn: turnRef },
    topicRef,
    setTopicValue,
    invalidSnapshotMessage: ui.invalidJsonFile,
    onExportImported: handleExportImported,
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
      defaultProviderId: providerId,
      defaultModel,
      debateMode,
      uiLang,
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
  }), [messages, participants, baseUrl, providerId, defaultModel, debateMode, uiLang, conclusions, summary, topMenuUi.exportHtml, topMenuUi.exportMarkdown, topMenuUi.exportJson])

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

  /**
   * The AI Providers dialog, scoped to one thing that picks a model — a
   * participant, or the round summary. Everything but the title, the provider
   * it is showing and the model it selects is the same for both, so the two
   * used to be one long block and one dead endpoint editor.
   */
  const buildProviderDialog = ({ title, modalProviderId, onProviderChange, selectedModel, onSelectedModelChange }) => {
  const participantModalProviderId = modalProviderId
  const participantModalConfig = providerModelSettings[participantModalProviderId] ?? { defaultModel: '', disabledModels: [] }
  const participantModalModels = participantModalProviderId === providerId ? availableModels : (providerModels[participantModalProviderId] ?? [])
  const participantModalSelectedModel = selectedModel
  const handleParticipantDialogModelChange = onSelectedModelChange
  return {
    title,
    providerId: participantModalProviderId,
    onProviderChange,
    onRefreshProvider: () => { void loadProviderModels(participantModalProviderId, true).catch(error => setConnectError(error.message)) },
    ollamaCloudHasSavedKey,
    onOllamaCloudConnect: handleParticipantCloudConnect,
    endpoint: endpointInput,
    onConnect: handleParticipantProviderConnect,
    connecting,
    connectError,
    ollamaOk,
    history: endpointHistory,
    onDeleteHistoryEntry: entry => setEndpointHistory(Storage.deleteEndpointFromHistory(entry)),
    models: participantModalModels,
    disabledModels: participantModalConfig.disabledModels,
    onToggleModel: (model, enabled) => {
      updateProviderModelConfig(participantModalProviderId, current => {
        const rest = current.disabledModels.filter(entry => entry !== model)
        const nextDisabled = enabled ? rest : [...rest, model]
        return {
          defaultModel: !enabled && current.defaultModel === model ? AI.firstEnabledModel(participantModalModels, nextDisabled) : current.defaultModel,
          disabledModels: nextDisabled,
        }
      })
      if (!enabled && participantModalSelectedModel === model) handleParticipantDialogModelChange('')
    },
    onSetAllModelsEnabled: enabled => {
      updateProviderModelConfig(participantModalProviderId, current => ({
        ...current,
        defaultModel: enabled ? current.defaultModel : '',
        disabledModels: enabled ? [] : [...participantModalModels],
      }))
      if (!enabled) handleParticipantDialogModelChange('')
    },
    defaultModel: participantModalConfig.defaultModel,
    onDefaultModelChange: model => updateProviderModelConfig(participantModalProviderId, current => ({ ...current, defaultModel: model })),
    defaultThinkingLevel: providerDefaultThinkingLevels[participantModalProviderId],
    onDefaultThinkingLevelChange: level => updateProviderModelConfig(participantModalProviderId, current => ({ ...current, defaultThinkingLevel: Debate.normalizeThinkingLevel(level) })),
    selectedModel: participantModalSelectedModel,
    onSelectedModelChange: handleParticipantDialogModelChange,
    disabled: running,
  }
  }

  const participantProviderModal = activeEndpointModal?.target === 'participant-provider' ? activeEndpointModal : null
  const participantProviderSettings = participantProviderModal ? buildProviderDialog({
    title: `AI Providers · ${participantProviderModal.participantLabel}`,
    modalProviderId: participantProviderModal.providerId || providerId,
    onProviderChange: handleParticipantDialogProviderChange,
    selectedModel: participants[participantProviderModal.idx]?.model ?? '',
    onSelectedModelChange: handleParticipantDialogModelChange,
  }) : null

  const summaryProviderModal = activeEndpointModal?.target === 'summary-provider' ? activeEndpointModal : null
  const summaryProviderSettings = summaryProviderModal ? buildProviderDialog({
    title: `AI Providers · ${ui.contextSummary}`,
    modalProviderId: summaryProviderModal.providerId || providerId,
    onProviderChange: selectedProvider => {
      if (!selectedProvider) return
      setEndpointModal(current => current?.target === 'summary-provider' ? { ...current, providerId: selectedProvider } : current)
      setSummaryProviderId(selectedProvider)
      // The model belonged to the provider being left.
      setSummaryModelOverride('')
      void loadProviderModels(selectedProvider).catch(error => setConnectError(error.message))
    },
    selectedModel: summaryModelOverride,
    onSelectedModelChange: model => {
      setSummaryProviderId(summaryProviderModal.providerId || providerId)
      setSummaryModelOverride(model)
    },
  }) : null

  return (
    <div className="h-screen w-full items-stretch 2xl:flex 2xl:flex-row" style={{ ...styles.app, flexDirection: isWideLayout ? 'row' : 'column', alignItems: 'stretch' }}>
      <GlobalStyles />
      {splash.visible && (
        <SplashScreen
          showOnStartup={splash.showOnStartup}
          onShowOnStartupChange={splash.setShowOnStartup}
          onClose={splash.close}
          onStart={() => { splash.close(); setWizardOpen(true) }}
        />
      )}
      {importNoticeVisible && (
        <ImportNoticeModal
          showAgain={showImportNotice}
          onShowAgainChange={changeShowImportNotice}
          onClose={() => setImportNoticeVisible(false)}
        />
      )}
      {wizardOpen && (
        <DebateWizard
          wizard={wizard}
          onClose={() => { wizard.cancel(); setWizardOpen(false) }}
          onGenerate={handleWizardGenerate}
          debateMode={debateMode}
          debateModeOptions={localizedModeOptions}
          uiLang={uiLang}
          characterTypes={localizedCharacterTypes}
          moodSelectStyles={moodSelectStyles}
          endpointValue={endpointInput || DEFAULT_URL}
          endpointHistory={endpointHistory}
          onConnect={connectMainEndpoint}
          connecting={connecting}
          connectError={connectError}
          ollamaOk={ollamaOk}
          models={models}
          defaultModel={defaultModel}
          onDefaultModelChange={setDefaultModel}
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
          onNewChat={handleReset}
          onFork={handleFork}
          canFork={!running && messages.length > 0}
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
          debateModeOptions={localizedModeOptions}
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
          // Back to the general default means back to it whole, provider and
          // endpoint included — the same rule the participants follow.
          onSummaryModelOverrideChange={value => {
            setSummaryModelOverride(value)
            if (!value) {
              setSummaryProviderId('')
              setSummaryEndpointOverride('')
            }
          }}
          models={summaryProviderId && summaryProviderId !== providerId ? (providerModels[summaryProviderId] ?? NO_MODELS) : models}
          providerId={summaryProviderId}
          defaultProviderId={providerId}
          running={running}
          defaultModel={defaultModel}
          summaryEndpointOverride={summaryEndpointOverride}
          summaryEndpointState={endpointStatuses[SUMMARY_ENDPOINT_ID]?.state ?? ''}
          onConfigureEndpoint={handleConfigureSummaryProvider}
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
          characterTypes={localizedCharacterTypes}
          responseLengths={localizedResponseLengths}
          moodSelectStyles={moodSelectStyles}
          moodOptions={localizedMoodOptions}
          formatMoodOption={formatMoodOption}
          moods={localizedMoods}
          moodIntensity={localizedMoodIntensity}
          defaultMoodIntensity={Debate.DEFAULT_MOOD_INTENSITY}
          educationLevels={localizedEducationLevels}
          ageGroups={localizedAgeGroups}
          defaultAgeGroup={Debate.DEFAULT_AGE_GROUP}
          models={models}
          providerModels={{ ...participantProviderModels, [providerId]: models }}
          defaultProviderId={providerId}
          palette={PALETTE}
          mkParticipant={Debate.mkParticipant}
          onResetAffinities={handleResetAffinities}
          onResetProviders={handleResetProviders}
          onAddConstraint={handleAddParticipantConstraint}
          onEditConstraint={handleEditParticipantConstraint}
          onDeleteConstraint={handleDeleteParticipantConstraint}
          onRequestRemoveParticipant={handleRequestRemoveParticipant}
          onConfigureEndpoint={handleConfigureParticipantEndpoint}
          onConfigureCustomLang={handleConfigureCustomLang}
          endpointStatuses={endpointStatuses}
          modelCapabilities={modelCapabilities}
          wand={wand}
          defaultModel={defaultModel}
          defaultThinkingLevel={defaultThinkingLevel}
          providerThinkingLevels={providerDefaultThinkingLevels}
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
           onResume={handleResumeFromChat}
          isWideLayout={isWideLayout}
        />
        {summaryInProgress && <SummaryProgressBadge />}
        <ConclusionsPanel
          running={running}
          messages={messages}
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
          const files = [...e.dataTransfer.files].filter(f => /\.(txt|md|pdf)$/i.test(f.name) || isImageFileName(f.name))
          if (files.length === 0) return
          e.preventDefault()
          await addFiles(files)
        }}
      >
        {/* ── column wrapper: attachments above, controls row below ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 }}>
        <AttachmentsChips attachments={attachedDocs} onRemove={removeAttachment} />
        {/* ── row: topic input + buttons ──
            Bottom-aligned, not stretched: the topic field grows with what is
            typed into it, and a stretched Start button grew into a slab beside
            a paragraph-long topic. */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <TopicComposer
          hasTopic={hasTopic}
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
          syncTopicFlag={syncTopicFlag}
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

        <GlobalConstraintsMenu
          constraints={globalConstraints}
          onAdd={handleAddGlobalConstraint}
          onEdit={handleEditGlobalConstraint}
          onDelete={handleDeleteGlobalConstraint}
        />

        <InputActionButtons
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
          hasTopic={hasTopic}
          topicRef={topicRef}
          textareaRef={textareaRef}
          onStart={() => handleStart()}
          onStop={handleStop}
          onForceStop={handleForceStop}
          onIntervene={handleInterjection}
          onResume={() => handleResume()}
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
        wand={wand}
        endpointModal={activeEndpointModal}
        scopedProviderSettings={participantProviderSettings ?? summaryProviderSettings}
        onCloseEndpointModal={handleCloseEndpointModal}
        customLangModal={customLangModal}
        onCloseCustomLangModal={() => setCustomLangModal(null)}
        onConfirmCustomLang={handleSaveCustomLang}
        endpointHistory={endpointHistory}
        onDeleteEndpointHistoryEntry={entry => setEndpointHistory(Storage.deleteEndpointFromHistory(entry))}
        defaultModel={defaultModel}
        onDefaultModelChange={setDefaultModel}
        defaultThinkingLevel={defaultThinkingLevel}
        onDefaultThinkingLevelChange={setDefaultThinkingLevel}
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
        debugPayloadTurns={debugPayloadTurns}
        onDebugPayloadTurnsChange={setDebugPayloadTurns}
        onRestoreNotices={handleRestoreNotices}
        running={running}
        enabledTools={enabledTools}
        onEnabledToolsChange={setEnabledTools}
        searchApiKey={searchApiKey}
        onSearchApiKeyChange={setSearchApiKey}
        searchEngine={searchEngine}
        onSearchEngineChange={setSearchEngine}
        pageBlockKb={pageBlockKb}
        onPageBlockKbChange={setPageBlockKb}
        endpointInput={endpointInput}
        providerId={providerId}
        onProviderChange={handleProviderChange}
        onRefreshProvider={() => fetchModels(baseUrl, providerId)}
        ollamaCloudHasSavedKey={ollamaCloudHasSavedKey}
        onOllamaCloudConnect={handleOllamaCloudConnect}
        onConnectEndpoint={connectMainEndpoint}
        availableModels={availableModels}
        disabledModels={disabledModels}
        onToggleModelEnabled={handleToggleModelEnabled}
        onSetAllModelsEnabled={handleSetAllModelsEnabled}
      />
      </div>
    </div>
  )
}
