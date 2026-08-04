import { useEffect, useState } from 'react'
import { Storage } from '../data/Storage'
import { Debate } from '../debate/Debate'
import {
  DEBUG_MODE_STORAGE_KEY,
  DEFAULT_DYNAMIC_AFFINITY,
  DEFAULT_FALLBACK_MODEL,
  DEFAULT_MAX_TURNS,
  DEFAULT_MODERATION_COOLING,
  DEFAULT_SUMMARY_ACCUMULATE,
  DEFAULT_SUMMARY_ACCUMULATE_THRESHOLD,
  DEFAULT_SUMMARY_MODEL_ENABLED,
  DEFAULT_SUMMARY_MODEL_OVERRIDE,
  DEFAULT_SUMMARIZE_ATTACHMENTS,
  DEFAULT_TIMEOUT_SEC,
  DEFAULT_URL,
  DEFAULT_USE_SUMMARY,
  normalizeModerationCooling,
} from '../settings/Settings'
import { DEFAULT_GENERAL_PERSONALITY_INSTRUCTIONS } from '../prompts/DefaultGeneralPersonalityInstructions'
import { DEFAULT_DEBATE_MODE, normalizeDebateMode } from '../prompts/Modes'
import { DEFAULT_ENABLED_TOOLS, normalizeEnabledTools } from '../tools/ToolSettings'

export function useAppSettings() {
  const saved = Storage.loadSettings()
  const [endpointInput, setEndpointInput] = useState(saved?.baseUrl ?? DEFAULT_URL)
  const [baseUrl, setBaseUrl] = useState(saved?.baseUrl ?? DEFAULT_URL)
  const [participants, setParticipants] = useState(() => saved?.participants?.length >= 2
    ? Debate.hydrateParticipantsFromSession(saved.participants)
    : [Debate.mkParticipant(0, ''), Debate.mkParticipant(1, '')])
  const [globalConstraints, setGlobalConstraints] = useState(() => saved?.globalConstraints ?? [])
  const [generalPersonalityInstructions, setGeneralPersonalityInstructions] = useState(() => saved?.generalPersonalityInstructions ?? DEFAULT_GENERAL_PERSONALITY_INSTRUCTIONS)
  const [maxTurns, setMaxTurns] = useState(saved?.maxTurns ?? DEFAULT_MAX_TURNS)
  const [useSummary, setUseSummary] = useState(saved?.useSummary ?? DEFAULT_USE_SUMMARY)
  const [dynamicAffinity, setDynamicAffinity] = useState(saved?.dynamicAffinity ?? DEFAULT_DYNAMIC_AFFINITY)
  const [moderationCooling, setModerationCooling] = useState(() => normalizeModerationCooling(saved?.moderationCooling ?? DEFAULT_MODERATION_COOLING))
  const [summaryModelOverride, setSummaryModelOverride] = useState(saved?.summaryModelOverride ?? DEFAULT_SUMMARY_MODEL_OVERRIDE)
  const [summaryEndpointOverride, setSummaryEndpointOverride] = useState(saved?.summaryEndpointOverride ?? '')
  const [summaryAccumulateThreshold, setSummaryAccumulateThreshold] = useState(saved?.summaryAccumulateThreshold ?? DEFAULT_SUMMARY_ACCUMULATE_THRESHOLD)
  const [summarizeAttachments, setSummarizeAttachments] = useState(saved?.summarizeAttachments ?? DEFAULT_SUMMARIZE_ATTACHMENTS)
  const [debugMode, setDebugMode] = useState(() => localStorage.getItem(DEBUG_MODE_STORAGE_KEY) === 'true')
  const [uiLang, setUiLang] = useState(saved?.uiLang ?? Debate.detectBrowserLang())
  const [interfaceLang, setInterfaceLang] = useState(saved?.interfaceLang ?? Debate.detectBrowserLang())
  const [timeoutSec, setTimeoutSec] = useState(saved?.timeoutSec ?? DEFAULT_TIMEOUT_SEC)
  const [defaultModel, setDefaultModel] = useState(saved?.defaultModel ?? DEFAULT_FALLBACK_MODEL)
  const [debateMode, setDebateMode] = useState(() => normalizeDebateMode(saved?.debateMode ?? DEFAULT_DEBATE_MODE))
  const [enabledTools, setEnabledTools] = useState(() => normalizeEnabledTools(saved?.enabledTools ?? DEFAULT_ENABLED_TOOLS))

  return {
    saved,
    endpointInput, setEndpointInput, baseUrl, setBaseUrl,
    participants, setParticipants,
    globalConstraints, setGlobalConstraints,
    generalPersonalityInstructions, setGeneralPersonalityInstructions,
    maxTurns, setMaxTurns, useSummary, setUseSummary,
    dynamicAffinity, setDynamicAffinity, moderationCooling, setModerationCooling,
    summaryModelOverride, setSummaryModelOverride,
    summaryEndpointOverride, setSummaryEndpointOverride,
    summaryAccumulateThreshold, setSummaryAccumulateThreshold,
    summarizeAttachments, setSummarizeAttachments, debugMode, setDebugMode, uiLang, setUiLang,
    interfaceLang, setInterfaceLang,
    timeoutSec, setTimeoutSec, defaultModel, setDefaultModel,
    debateMode, setDebateMode, enabledTools, setEnabledTools,
  }
}

export function usePersistedAppSettings({ settings, conclusions }) {
  const {
    participants, maxTurns, timeoutSec, baseUrl, useSummary, dynamicAffinity,
    moderationCooling, summaryModelOverride, summaryEndpointOverride,
    summaryAccumulateThreshold, summarizeAttachments, uiLang, interfaceLang, globalConstraints,
    generalPersonalityInstructions, defaultModel,
    debateMode,
    enabledTools,
  } = settings
  const { conclusionModel, customConclusionPrompt, standardConclusionPrompt } = conclusions
  useEffect(() => {
    Storage.saveSettings({
      participants: Debate.serializeParticipantsForSession(participants),
      maxTurns, timeoutSec, baseUrl, useSummary, dynamicAffinity, moderationCooling,
      summaryModelOverride, summaryEndpointOverride, summaryAccumulateThreshold,
      summarizeAttachments, uiLang, interfaceLang, defaultModel,
      conclusionModel,
      customConclusionPrompt: customConclusionPrompt ?? '',
      standardConclusionPrompt: standardConclusionPrompt ?? '',
      globalConstraints: globalConstraints ?? [],
      generalPersonalityInstructions: generalPersonalityInstructions ?? DEFAULT_GENERAL_PERSONALITY_INSTRUCTIONS,
      debateMode: normalizeDebateMode(debateMode),
      enabledTools,
    })
  }, [participants, maxTurns, timeoutSec, baseUrl, useSummary, dynamicAffinity, moderationCooling, summaryModelOverride, summaryEndpointOverride, summaryAccumulateThreshold, summarizeAttachments, uiLang, interfaceLang, defaultModel, conclusionModel, customConclusionPrompt, standardConclusionPrompt, globalConstraints, generalPersonalityInstructions, debateMode, enabledTools])
}
