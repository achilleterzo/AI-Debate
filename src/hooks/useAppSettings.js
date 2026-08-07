import { useEffect, useState } from 'react'
import { Storage } from '../data/Storage'
import { Debate } from '../debate/Debate'
import { Web } from '../services/Web'
import {
  DEBUG_MODE_STORAGE_KEY,
  DEFAULT_DYNAMIC_AFFINITY,
  DEFAULT_FALLBACK_MODEL,
  DEFAULT_MAX_TURNS,
  DEFAULT_MODERATION_COOLING,
  DEFAULT_RANDOM_TURN_ORDER,
  DEFAULT_SUMMARY_ACCUMULATE,
  DEFAULT_SUMMARY_ACCUMULATE_THRESHOLD,
  DEFAULT_SUMMARY_MODEL_ENABLED,
  DEFAULT_SUMMARY_MODEL_OVERRIDE,
  DEFAULT_SUMMARIZE_ATTACHMENTS,
  DEFAULT_PAGE_BLOCK_KB,
  DEFAULT_SEARCH_API_KEY,
  DEFAULT_TIMEOUT_SEC,
  DEFAULT_URL,
  DEFAULT_USE_SUMMARY,
  normalizeModerationCooling,
  normalizePageBlockKb,
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
  const [randomTurnOrder, setRandomTurnOrder] = useState(saved?.randomTurnOrder ?? DEFAULT_RANDOM_TURN_ORDER)
  const [moderationCooling, setModerationCooling] = useState(() => normalizeModerationCooling(saved?.moderationCooling ?? DEFAULT_MODERATION_COOLING))
  // Sessions saved before this switch existed have no flag: an override
  // already configured back then stays active instead of being silently
  // dropped back to the default model.
  const [summaryModelEnabled, setSummaryModelEnabled] = useState(() => saved?.summaryModelEnabled
    ?? (saved ? !!(saved.summaryModelOverride || saved.summaryEndpointOverride) : DEFAULT_SUMMARY_MODEL_ENABLED))
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
  const [searchApiKey, setSearchApiKey] = useState(saved?.searchApiKey ?? DEFAULT_SEARCH_API_KEY)
  const [pageBlockKb, setPageBlockKb] = useState(() => normalizePageBlockKb(saved?.pageBlockKb ?? DEFAULT_PAGE_BLOCK_KB))

  return {
    saved,
    endpointInput, setEndpointInput, baseUrl, setBaseUrl,
    participants, setParticipants,
    globalConstraints, setGlobalConstraints,
    generalPersonalityInstructions, setGeneralPersonalityInstructions,
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
    debateMode, setDebateMode, enabledTools, setEnabledTools,
    searchApiKey, setSearchApiKey, pageBlockKb, setPageBlockKb,
  }
}

export function usePersistedAppSettings({ settings, conclusions }) {
  const {
    participants, maxTurns, timeoutSec, baseUrl, useSummary, dynamicAffinity, randomTurnOrder,
    moderationCooling, summaryModelEnabled, summaryModelOverride, summaryEndpointOverride,
    summaryAccumulateThreshold, summarizeAttachments, uiLang, interfaceLang, globalConstraints,
    generalPersonalityInstructions, defaultModel,
    debateMode,
    enabledTools,
    searchApiKey,
    pageBlockKb,
  } = settings
  const { conclusionModel, customConclusionPrompt, standardConclusionPrompt } = conclusions

  // The web service is a static class reached from non-React code, so the
  // settings have to be pushed into it rather than read out of a context.
  useEffect(() => {
    Web.configure({ searchApiKey, pageBlockKb: normalizePageBlockKb(pageBlockKb) })
  }, [searchApiKey, pageBlockKb])

  useEffect(() => {
    Storage.saveSettings({
      participants: Debate.serializeParticipantsForSession(participants),
      maxTurns, timeoutSec, baseUrl, useSummary, dynamicAffinity, randomTurnOrder, moderationCooling,
      summaryModelEnabled, summaryModelOverride, summaryEndpointOverride, summaryAccumulateThreshold,
      summarizeAttachments, uiLang, interfaceLang, defaultModel,
      conclusionModel,
      customConclusionPrompt: customConclusionPrompt ?? '',
      standardConclusionPrompt: standardConclusionPrompt ?? '',
      globalConstraints: globalConstraints ?? [],
      generalPersonalityInstructions: generalPersonalityInstructions ?? DEFAULT_GENERAL_PERSONALITY_INSTRUCTIONS,
      debateMode: normalizeDebateMode(debateMode),
      enabledTools,
      searchApiKey: searchApiKey ?? DEFAULT_SEARCH_API_KEY,
      pageBlockKb: normalizePageBlockKb(pageBlockKb),
    })
  }, [participants, maxTurns, timeoutSec, baseUrl, useSummary, dynamicAffinity, randomTurnOrder, moderationCooling, summaryModelEnabled, summaryModelOverride, summaryEndpointOverride, summaryAccumulateThreshold, summarizeAttachments, uiLang, interfaceLang, defaultModel, conclusionModel, customConclusionPrompt, standardConclusionPrompt, globalConstraints, generalPersonalityInstructions, debateMode, enabledTools, searchApiKey, pageBlockKb])
}
