import { useState, useRef, useCallback, useMemo } from 'react'
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
import ConnectionSettings from './components/ConnectionSettings'
import AffinitySettings from './components/AffinitySettings'
import SummarySettings from './components/SummarySettings'
import DebateLimitsSettings from './components/DebateLimitsSettings'
import SummaryPanel from './components/SummaryPanel'
import HeaderTop from './components/HeaderTop'
import InputActionButtons from './components/InputActionButtons'
import AppModals from './components/AppModals'
import ScrollToBottomButton from './components/ScrollToBottomButton'
import SummaryProgressBadge from './components/SummaryProgressBadge'
import PromptEstimateBadge from './components/PromptEstimateBadge'
import { PALETTE } from './dataset/Palette'
import { MOODS, MOOD_OPTIONS } from './prompts/Moods'
import { RESPONSE_LENGTHS } from './prompts/ResponseLengths'
import { CHARACTER_TYPES } from './dataset/CharacterTypes'
import { EDUCATION_LEVELS } from './prompts/EducationLevels'
import { MOOD_INTENSITY } from './prompts/MoodIntensity'
import { AGE_GROUPS } from './prompts/AgeGroups'
import { UI_STRINGS } from './i18n/UiStrings'
import { DEFAULT_GENERAL_PERSONALITY_INSTRUCTIONS } from './prompts/DefaultGeneralPersonalityInstructions'
import { DEFAULT_URL } from './settings/Settings'
import { formatMoodOption, GlobalStyles, modelSelectStyles, moodSelectStyles, styles } from './components/Style'
import { Debate } from './debate/Debate'
import { useDebateController } from './debate/DebateController'
import { useSnapshots } from './hooks/useSnapshots'
import { useConclusions } from './hooks/useConclusions'
import { useEndpointStatuses } from './hooks/useEndpointStatuses'
import { useAppLayout } from './hooks/useAppLayout'
import { useTopicComposer } from './hooks/useTopicComposer'
import { useAppSettings, usePersistedAppSettings } from './hooks/useAppSettings'
import { useAttachments } from './hooks/useAttachments'
import { CONCLUSION_TYPES } from './prompts/ConclusionTypes'

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
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
  const { attachedDocs, inputRef: docInputRef, addFiles, removeAttachment } = useAttachments()
  const settings = useAppSettings()
  const {
    saved, endpointInput, setEndpointInput, baseUrl, setBaseUrl, participants, setParticipants,
    globalConstraints, setGlobalConstraints, generalPersonalityInstructions, setGeneralPersonalityInstructions,
    maxTurns, setMaxTurns, recentK, setRecentK, useSummary, setUseSummary,
    dynamicAffinity, setDynamicAffinity, moderationCooling, setModerationCooling,
    summaryModelEnabled, setSummaryModelEnabled, summaryModelOverride, setSummaryModelOverride,
    summaryAccumulate, setSummaryAccumulate, summaryAccumulateThreshold, setSummaryAccumulateThreshold,
    summarizeAttachments, setSummarizeAttachments, debugMode, setDebugMode, uiLang, setUiLang,
    timeoutSec, setTimeoutSec,
  } = settings
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
  const confirmActionRef = useRef(null)
  const [summary, setSummary] = useState('')
  const [summaryDebug, setSummaryDebug] = useState(null) // { payload, debugPayloads } from the latest summary
  const [summaryVisible, setSummaryVisible] = useState(false)
  const [summaryInProgress, setSummaryInProgress] = useState(false)
  const [lastPromptEstimate, setLastPromptEstimate] = useState(null) // { model, messageCount, totalChars, estimatedTokens }
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
    summaryModelEnabled,
    summaryModelOverride,
    attachedDocs,
    messages,
    summaryRef,
    conversationRef: conclusionConvRef,
    baseUrl,
    uiLang,
    timeoutSec,
    nextSeq,
    setLastPromptEstimate,
  })
  const {
    conclusions,
    setConclusions,
    customConclusionPrompt,
    setCustomConclusionPrompt,
    standardConclusionPrompt,
    setStandardConclusionPrompt,
  } = conclusionsState

  usePersistedAppSettings({ settings, conclusions: conclusionsState })

  const endpointStatuses = useEndpointStatuses(participants)
  const {
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
  } = useAppLayout({ messages, streamingRole, headerOpen, summary, summaryVisible })

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

  const handleStop = () => stopDebate()

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
  const handleReset = () => {
    setMessages([])
    setTopicValue('')
    setSummary('')
    setSummaryDebug(null)
    summaryRef.current = ''
    setConclusions([])
    seqRef.current = 0
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

  const { handleSaveSnapshot, handleLoadSnapshot } = useSnapshots({
    state: {
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
      conclusions,
    },
    actions: {
      setParticipants,
      setGlobalConstraints,
      setGeneralPersonalityInstructions,
      setCustomConclusionPrompt,
      setStandardConclusionPrompt,
      setMaxTurns,
      setRecentK,
      setTimeoutSec,
      setModerationCooling,
      setUseSummary,
      setSummarizeAttachments,
      setBaseUrl,
      setEndpointInput,
      setMessages,
      setConclusions,
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
  }), [messages, participants, baseUrl, conclusions, summary, topMenuUi.exportHtml, topMenuUi.exportMarkdown, topMenuUi.exportJson])

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
        <HeaderTop
          headerTopRef={headerTopRef}
          running={running}
          onSaveSnapshot={handleSaveSnapshot}
          onLoadSnapshot={handleLoadSnapshot}
          onOpenPromptSettings={handleOpenPromptSettings}
          exportItems={exportItems}
          onClearSettings={handleClearSettings}
          ollamaOk={ollamaOk}
          modelsCount={models.length}
          is2xlLayout={is2xlLayout}
          headerOpen={headerOpen}
          onToggleHeaderOpen={() => setHeaderOpen(v => !v)}
        />

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

        <ConnectionSettings
          uiLang={uiLang}
          onUiLangChange={setUiLang}
          endpointInput={endpointInput}
          onEndpointChange={setEndpointInput}
          onConnect={handleConnect}
          connecting={connecting}
          connectError={connectError}
          disabled={running}
        />

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
        <AffinitySettings
          dynamicAffinity={dynamicAffinity}
          onDynamicAffinityChange={setDynamicAffinity}
          moderationCooling={moderationCooling}
          onModerationCoolingChange={setModerationCooling}
          running={running}
        />

        <SummarySettings
          useSummary={useSummary}
          onUseSummaryChange={setUseSummary}
          summarizeAttachments={summarizeAttachments}
          onSummarizeAttachmentsChange={setSummarizeAttachments}
          summaryAccumulate={summaryAccumulate}
          onSummaryAccumulateChange={setSummaryAccumulate}
          summaryAccumulateThreshold={summaryAccumulateThreshold}
          onSummaryAccumulateThresholdChange={setSummaryAccumulateThreshold}
          summaryModelEnabled={summaryModelEnabled}
          onSummaryModelEnabledChange={setSummaryModelEnabled}
          summaryModelOverride={summaryModelOverride}
          onSummaryModelOverrideChange={setSummaryModelOverride}
          models={models}
          modelSelectStyles={modelSelectStyles}
          running={running}
        />

        <DebateLimitsSettings
          maxTurns={maxTurns}
          onMaxTurnsChange={setMaxTurns}
          timeoutSec={timeoutSec}
          onTimeoutSecChange={setTimeoutSec}
          recentK={recentK}
          onRecentKChange={setRecentK}
          useSummary={useSummary}
          debugMode={debugMode}
          onDebugModeChange={next => { localStorage.setItem('debugMode', next); setDebugMode(next) }}
          running={running}
        />
	</div>
</div> {/* end accordion */}
</div>
</div>

      {/* ── right column: summary + chat + prompt ── */}
      <div className="flex min-w-0 flex-1 flex-col" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: is2xlLayout ? '100vh' : 'auto', position: 'relative' }}>
      <SummaryPanel
        panelRef={summaryPanelRef}
        streamingRole={streamingRole}
        contextEstimate={contextEstimate}
        summary={summary}
        summaryVisible={summaryVisible}
        onToggleVisible={() => setSummaryVisible(v => !v)}
        debugMode={debugMode}
        summaryDebug={summaryDebug}
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
          moods={MOODS}
          moodIntensity={MOOD_INTENSITY}
          defaultMoodIntensity={Debate.DEFAULT_MOOD_INTENSITY}
          DotsComponent={DotsView}
           onResume={() => handleResume()}
          is2xlLayout={is2xlLayout}
        />
        {summaryInProgress && <SummaryProgressBadge />}
        <ConclusionsPanel
          running={running}
          messages={messages}
          models={models}
          modelSelectStyles={modelSelectStyles}
          conclusions={conclusionsState}
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
        <PromptEstimateBadge estimate={lastPromptEstimate} />
        </div>{/* end column wrapper */}
      </div>
      <AppModals
        payloadModal={payloadModal}
        onClosePayloadModal={() => setPayloadModal(null)}
        constraintModal={constraintModal}
        onCloseConstraintModal={() => setConstraintModal(null)}
        onConfirmConstraint={handleConstraintConfirm}
        globalConstraintHistory={globalConstraintHistory}
        onDeleteGlobalSuggestion={handleDeleteGlobalSuggestion}
        endpointModal={endpointModal}
        onCloseEndpointModal={() => setEndpointModal(null)}
        onConfirmEndpoint={handleSaveParticipantEndpoint}
        promptSettingsModal={promptSettingsModal}
        generalPersonalityInstructions={generalPersonalityInstructions}
        onClosePromptSettings={() => setPromptSettingsModal(false)}
        onSavePromptSettings={handleSavePromptSettings}
        onResetPromptSettings={handleResetPromptSettings}
        confirmModal={confirmModal}
        onCancelConfirmModal={handleCancelConfirmModal}
        onConfirmModal={handleConfirmModal}
      />
      </div>
    </div>
  )
}
