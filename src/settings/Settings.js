export const DEFAULT_URL = 'http://localhost:11434'
export const DEFAULT_MAX_TURNS = 6
export const DEFAULT_RECENT_K = 0
export const DEFAULT_USE_SUMMARY = true
export const DEFAULT_DYNAMIC_AFFINITY = true
export const DEFAULT_SUMMARY_MODEL_ENABLED = false
export const DEFAULT_SUMMARY_MODEL_OVERRIDE = ''
export const DEFAULT_SUMMARY_ACCUMULATE = true
export const DEFAULT_SUMMARY_ACCUMULATE_THRESHOLD = 8
export const DEFAULT_SUMMARIZE_ATTACHMENTS = true
export const DEFAULT_TIMEOUT_SEC = 120
export const DEBUG_MODE_STORAGE_KEY = 'debugMode'

export const DEFAULT_MODERATION_COOLING = 0.15
export const MIN_MODERATION_COOLING = 0.01
export const MAX_MODERATION_COOLING = 1
export const MODERATION_COOLING_STEPS = [0.05, 0.1, 0.15, 0.2, 0.3, 0.4]

export const SUMMARY_ACCUMULATE_STEPS = [2, 4, 8, 16, 32, 64]

export function normalizeModerationCooling(raw) {
  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_MODERATION_COOLING
  return Math.min(MAX_MODERATION_COOLING, Math.max(MIN_MODERATION_COOLING, value))
}
