import { useCallback, useEffect, useMemo, useState } from 'react'
import { Storage } from '../data/Storage'
import { Debate } from '../debate/Debate'
import { Web } from '../services/Web'
import {
  DEBUG_MODE_STORAGE_KEY,
  DEFAULT_DISABLED_MODELS,
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
  DEFAULT_PROVIDER_ID,
  DEFAULT_SEARCH_API_KEY,
  DEFAULT_TIMEOUT_SEC,
  DEFAULT_DEBUG_PAYLOAD_TURNS,
  DEFAULT_URL,
  DEFAULT_USE_SUMMARY,
  normalizeDebugPayloadTurns,
  normalizeDisabledModels,
  MODEL_PROVIDER_IDS,
  normalizeProviderModelSettings,
  providerThinkingLevels,
  normalizeModerationCooling,
  normalizePageBlockKb,
} from '../settings/Settings'
import { DEFAULT_GENERAL_PERSONALITY_INSTRUCTIONS } from '../prompts/DefaultGeneralPersonalityInstructions'
import { DEFAULT_DEBATE_MODE, normalizeDebateMode } from '../prompts/Modes'
import { normalizeStandardConclusionPrompts } from '../prompts/ConclusionTypes'
import { DEFAULT_ENABLED_TOOLS, normalizeEnabledTools } from '../tools/ToolSettings'

export function useAppSettings() {
  const saved = Storage.loadSettings()
  const [endpointInput, setEndpointInput] = useState(saved?.baseUrl ?? DEFAULT_URL)
  const [baseUrl, setBaseUrl] = useState(saved?.baseUrl ?? DEFAULT_URL)
  const [providerId, setProviderId] = useState(['ollama', 'ollama-cloud', 'openai', 'claude'].includes(saved?.providerId) ? saved.providerId : DEFAULT_PROVIDER_ID)
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
  // Empty means the general provider, exactly as it does for a participant.
  const [summaryProviderId, setSummaryProviderId] = useState(MODEL_PROVIDER_IDS.includes(saved?.summaryProviderId) ? saved.summaryProviderId : '')
  const [summaryEndpointOverride, setSummaryEndpointOverride] = useState(saved?.summaryEndpointOverride ?? '')
  const [summaryAccumulateThreshold, setSummaryAccumulateThreshold] = useState(saved?.summaryAccumulateThreshold ?? DEFAULT_SUMMARY_ACCUMULATE_THRESHOLD)
  const [summarizeAttachments, setSummarizeAttachments] = useState(saved?.summarizeAttachments ?? DEFAULT_SUMMARIZE_ATTACHMENTS)
  const [debugMode, setDebugMode] = useState(() => localStorage.getItem(DEBUG_MODE_STORAGE_KEY) === 'true')
  const [debugPayloadTurns, setDebugPayloadTurns] = useState(() => normalizeDebugPayloadTurns(saved?.debugPayloadTurns ?? DEFAULT_DEBUG_PAYLOAD_TURNS))
  const [uiLang, setUiLang] = useState(saved?.uiLang ?? Debate.detectBrowserLang())
  const [interfaceLang, setInterfaceLang] = useState(saved?.interfaceLang ?? Debate.detectBrowserLang())
  const [timeoutSec, setTimeoutSec] = useState(saved?.timeoutSec ?? DEFAULT_TIMEOUT_SEC)
  const [providerModelSettings, setProviderModelSettings] = useState(() => {
    const normalized = normalizeProviderModelSettings(saved?.providerModelSettings)
    const legacyProviderId = ['ollama', 'ollama-cloud', 'openai', 'claude'].includes(saved?.providerId) ? saved.providerId : DEFAULT_PROVIDER_ID
    if (!normalized[legacyProviderId]) {
      normalized[legacyProviderId] = {
        defaultModel: saved?.defaultModel ?? DEFAULT_FALLBACK_MODEL,
        disabledModels: normalizeDisabledModels(saved?.disabledModels ?? DEFAULT_DISABLED_MODELS),
      }
    }
    // Settings saved before providers had their own reasoning level carry one
    // shared level. Every provider starts from it, written down once, so that
    // changing one provider's level later cannot move the others with it.
    const sharedLevel = Debate.normalizeThinkingLevel(saved?.defaultThinkingLevel ?? Debate.DEFAULT_THINKING_LEVEL)
    for (const id of MODEL_PROVIDER_IDS) {
      const current = normalized[id] ?? { defaultModel: DEFAULT_FALLBACK_MODEL, disabledModels: DEFAULT_DISABLED_MODELS }
      normalized[id] = { ...current, defaultThinkingLevel: current.defaultThinkingLevel ?? sharedLevel }
    }
    return normalized
  })
  const currentProviderModelSettings = providerModelSettings[providerId] ?? { defaultModel: DEFAULT_FALLBACK_MODEL, disabledModels: DEFAULT_DISABLED_MODELS }
  const defaultModel = currentProviderModelSettings.defaultModel
  const disabledModels = currentProviderModelSettings.disabledModels
  const setDefaultModel = useCallback(value => {
    setProviderModelSettings(previous => {
      const current = previous[providerId] ?? { defaultModel: DEFAULT_FALLBACK_MODEL, disabledModels: DEFAULT_DISABLED_MODELS }
      const next = typeof value === 'function' ? value(current.defaultModel) : value
      return { ...previous, [providerId]: { ...current, defaultModel: String(next ?? '').trim() } }
    })
  }, [providerId])
  const setDisabledModels = useCallback(value => {
    setProviderModelSettings(previous => {
      const current = previous[providerId] ?? { defaultModel: DEFAULT_FALLBACK_MODEL, disabledModels: DEFAULT_DISABLED_MODELS }
      const next = typeof value === 'function' ? value(current.disabledModels) : value
      return { ...previous, [providerId]: { ...current, disabledModels: normalizeDisabledModels(next) } }
    })
  }, [providerId])
  // The level participants follow unless they picked one of their own. Each
  // provider keeps its own; the single level saved before that existed is what
  // a provider without one inherits.
  const legacyThinkingLevel = Debate.normalizeThinkingLevel(saved?.defaultThinkingLevel ?? Debate.DEFAULT_THINKING_LEVEL)
  const defaultThinkingLevel = currentProviderModelSettings.defaultThinkingLevel ?? legacyThinkingLevel
  const setDefaultThinkingLevel = useCallback(value => {
    setProviderModelSettings(previous => {
      const current = previous[providerId] ?? { defaultModel: DEFAULT_FALLBACK_MODEL, disabledModels: DEFAULT_DISABLED_MODELS }
      return { ...previous, [providerId]: { ...current, defaultThinkingLevel: Debate.normalizeThinkingLevel(value) } }
    })
  }, [providerId])
  const providerDefaultThinkingLevels = useMemo(() => providerThinkingLevels(providerModelSettings, legacyThinkingLevel), [providerModelSettings, legacyThinkingLevel])
  const [debateMode, setDebateMode] = useState(() => normalizeDebateMode(saved?.debateMode ?? DEFAULT_DEBATE_MODE))
  const [enabledTools, setEnabledTools] = useState(() => normalizeEnabledTools(saved?.enabledTools ?? DEFAULT_ENABLED_TOOLS))
  const [searchApiKey, setSearchApiKey] = useState(saved?.searchApiKey ?? DEFAULT_SEARCH_API_KEY)
  const [pageBlockKb, setPageBlockKb] = useState(() => normalizePageBlockKb(saved?.pageBlockKb ?? DEFAULT_PAGE_BLOCK_KB))

  return {
    saved,
    endpointInput, setEndpointInput, baseUrl, setBaseUrl, providerId, setProviderId,
    participants, setParticipants,
    globalConstraints, setGlobalConstraints,
    generalPersonalityInstructions, setGeneralPersonalityInstructions,
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
    debateMode, setDebateMode, enabledTools, setEnabledTools,
    searchApiKey, setSearchApiKey, pageBlockKb, setPageBlockKb,
  }
}

export function usePersistedAppSettings({ settings, conclusions }) {
  const {
    participants, maxTurns, timeoutSec, baseUrl, providerId, useSummary, dynamicAffinity, randomTurnOrder,
    moderationCooling, summaryModelEnabled, summaryModelOverride, summaryProviderId, summaryEndpointOverride,
    summaryAccumulateThreshold, summarizeAttachments, uiLang, interfaceLang, globalConstraints,
    generalPersonalityInstructions, defaultModel, disabledModels, providerModelSettings, defaultThinkingLevel,
    debugPayloadTurns,
    debateMode,
    enabledTools,
    searchApiKey,
    pageBlockKb,
  } = settings
  const { customConclusionPrompt, standardConclusionPrompts } = conclusions

  // The web service is a static class reached from non-React code, so the
  // settings have to be pushed into it rather than read out of a context.
  useEffect(() => {
    Web.configure({ searchApiKey, pageBlockKb: normalizePageBlockKb(pageBlockKb) })
  }, [searchApiKey, pageBlockKb])

  useEffect(() => {
    Storage.saveSettings({
      participants: Debate.serializeParticipantsForSession(participants),
      maxTurns, timeoutSec, baseUrl, providerId, useSummary, dynamicAffinity, randomTurnOrder, moderationCooling,
      summaryModelEnabled, summaryModelOverride, summaryProviderId, summaryEndpointOverride, summaryAccumulateThreshold,
      summarizeAttachments, uiLang, interfaceLang, defaultModel,
      disabledModels: normalizeDisabledModels(disabledModels),
      providerModelSettings: normalizeProviderModelSettings(providerModelSettings),
      defaultThinkingLevel: Debate.normalizeThinkingLevel(defaultThinkingLevel),
      customConclusionPrompt: customConclusionPrompt ?? '',
      standardConclusionPrompts: normalizeStandardConclusionPrompts(standardConclusionPrompts),
      globalConstraints: globalConstraints ?? [],
      generalPersonalityInstructions: generalPersonalityInstructions ?? DEFAULT_GENERAL_PERSONALITY_INSTRUCTIONS,
      debateMode: normalizeDebateMode(debateMode),
      enabledTools,
      searchApiKey: searchApiKey ?? DEFAULT_SEARCH_API_KEY,
      pageBlockKb: normalizePageBlockKb(pageBlockKb),
      debugPayloadTurns: normalizeDebugPayloadTurns(debugPayloadTurns),
    })
  }, [debugPayloadTurns, participants, maxTurns, timeoutSec, baseUrl, providerId, useSummary, dynamicAffinity, randomTurnOrder, moderationCooling, summaryModelEnabled, summaryModelOverride, summaryProviderId, summaryEndpointOverride, summaryAccumulateThreshold, summarizeAttachments, uiLang, interfaceLang, defaultModel, disabledModels, providerModelSettings, defaultThinkingLevel, customConclusionPrompt, standardConclusionPrompts, globalConstraints, generalPersonalityInstructions, debateMode, enabledTools, searchApiKey, pageBlockKb])
}
