export const DEFAULT_URL = 'http://localhost:11434'

/**
 * Below this width the settings column collapses into the accordion and the
 * app becomes a single column. The left column is a fixed 800px, so this is
 * about the narrowest window that still leaves the chat a usable share.
 *
 * Keep in sync with the #root media query in index.css, which caps the app
 * width in single-column mode.
 */
export const TWO_COLUMN_MIN_WIDTH = 1200
export const DEFAULT_MAX_TURNS = 6
export const DEFAULT_USE_SUMMARY = true
export const DEFAULT_DYNAMIC_AFFINITY = true
export const DEFAULT_RANDOM_TURN_ORDER = true
export const DEFAULT_SUMMARY_MODEL_ENABLED = false
export const DEFAULT_SUMMARY_MODEL_OVERRIDE = ''
export const DEFAULT_SUMMARY_ACCUMULATE = true
export const DEFAULT_SUMMARY_ACCUMULATE_THRESHOLD = 8
export const DEFAULT_SUMMARIZE_ATTACHMENTS = true
export const DEFAULT_TIMEOUT_SEC = 120
export const DEFAULT_FALLBACK_MODEL = ''
export const DEBUG_MODE_STORAGE_KEY = 'debugMode'

// The splash lives outside the settings blob so that clearing the saved
// settings does not silently bring the welcome screen back.
export const SPLASH_STORAGE_KEY = 'showSplashOnStartup'
export const DEFAULT_SHOW_SPLASH = true

// Injected by Vite from package.json (see vite.config.js). Lives here rather
// than in the update hook so non-React code — the exporters — can read it
// without pulling React in.
export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0'

export const UPDATE_REPO = 'achilleterzo/AI-Debate'
export const UPDATE_RELEASES_URL = `https://github.com/${UPDATE_REPO}/releases`
export const UPDATE_CHECK_TIMEOUT_MS = 10_000

export const DEFAULT_MODERATION_COOLING = 0.15
export const DEFAULT_MODERATOR_PERMISSIVENESS = 2
export const MODERATOR_PERMISSIVENESS_LEVELS = 5

// How many rounds pass between two scheduled facilitation turns. Only the
// facilitator style uses it: 1 means the moderator sums up every round.
export const DEFAULT_MODERATOR_FACILITATION_INTERVAL = 1
export const MIN_MODERATOR_FACILITATION_INTERVAL = 1
export const MAX_MODERATOR_FACILITATION_INTERVAL = 6
export const MIN_MODERATION_COOLING = 0.01
export const MAX_MODERATION_COOLING = 1
export const MODERATION_COOLING_STEPS = [0.05, 0.1, 0.15, 0.2, 0.3, 0.4]

export const SUMMARY_ACCUMULATE_STEPS = [2, 4, 8, 16, 32, 64]

export function normalizeModerationCooling(raw) {
  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_MODERATION_COOLING
  return Math.min(MAX_MODERATION_COOLING, Math.max(MIN_MODERATION_COOLING, value))
}

export function normalizeModeratorPermissiveness(raw) {
  const value = Number(raw)
  if (!Number.isFinite(value)) return DEFAULT_MODERATOR_PERMISSIVENESS
  return Math.min(MODERATOR_PERMISSIVENESS_LEVELS - 1, Math.max(0, Math.round(value)))
}

export function normalizeModeratorFacilitationInterval(raw) {
  const value = Number(raw)
  if (!Number.isFinite(value)) return DEFAULT_MODERATOR_FACILITATION_INTERVAL
  return Math.min(MAX_MODERATOR_FACILITATION_INTERVAL, Math.max(MIN_MODERATOR_FACILITATION_INTERVAL, Math.round(value)))
}
