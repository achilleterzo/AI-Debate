import { useEffect, useState } from 'react'
import { Storage } from '../data/Storage'
import { Debate } from '../debate/Debate'
import {
  DEBUG_MODE_STORAGE_KEY,
  DEFAULT_DYNAMIC_AFFINITY,
  DEFAULT_MAX_TURNS,
  DEFAULT_MODERATION_COOLING,
  DEFAULT_RECENT_K,
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

  return {
    saved,
    endpointInput, setEndpointInput, baseUrl, setBaseUrl,
    participants, setParticipants,
    globalConstraints, setGlobalConstraints,
    generalPersonalityInstructions, setGeneralPersonalityInstructions,
    maxTurns, setMaxTurns, recentK, setRecentK, useSummary, setUseSummary,
    dynamicAffinity, setDynamicAffinity, moderationCooling, setModerationCooling,
    summaryModelEnabled, setSummaryModelEnabled, summaryModelOverride, setSummaryModelOverride,
    summaryAccumulate, setSummaryAccumulate, summaryAccumulateThreshold, setSummaryAccumulateThreshold,
    summarizeAttachments, setSummarizeAttachments, debugMode, setDebugMode, uiLang, setUiLang,
    timeoutSec, setTimeoutSec,
  }
}

export function usePersistedAppSettings({ settings, conclusions }) {
  const {
    participants, maxTurns, recentK, timeoutSec, baseUrl, useSummary, dynamicAffinity,
    moderationCooling, summaryModelEnabled, summaryModelOverride, summaryAccumulate,
    summaryAccumulateThreshold, summarizeAttachments, uiLang, globalConstraints,
    generalPersonalityInstructions,
  } = settings
  const { conclusionModel, customConclusionPrompt, standardConclusionPrompt } = conclusions
  useEffect(() => {
    Storage.saveSettings({
      participants: Debate.serializeParticipantsForSession(participants),
      maxTurns, recentK, timeoutSec, baseUrl, useSummary, dynamicAffinity, moderationCooling,
      summaryModelEnabled, summaryModelOverride, summaryAccumulate, summaryAccumulateThreshold,
      summarizeAttachments, uiLang,
      conclusionModel,
      customConclusionPrompt: customConclusionPrompt ?? '',
      standardConclusionPrompt: standardConclusionPrompt ?? '',
      globalConstraints: globalConstraints ?? [],
      generalPersonalityInstructions: generalPersonalityInstructions ?? DEFAULT_GENERAL_PERSONALITY_INSTRUCTIONS,
    })
  }, [participants, maxTurns, recentK, timeoutSec, baseUrl, useSummary, dynamicAffinity, moderationCooling, summaryModelEnabled, summaryModelOverride, summaryAccumulate, summaryAccumulateThreshold, summarizeAttachments, uiLang, conclusionModel, customConclusionPrompt, standardConclusionPrompt, globalConstraints, generalPersonalityInstructions])
}
