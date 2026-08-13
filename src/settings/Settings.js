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

/**
 * Models switched off in the Ollama settings tab.
 *
 * An endpoint usually serves far more models than a table ever uses, and every
 * one of them lands in every picker. Disabling is a list, not a per-picker
 * filter: the names are dropped as the model list is retrieved, so nothing
 * downstream — pickers, the default model, the wizard — ever sees them.
 *
 * Kept as the exclusion rather than the selection on purpose: a model pulled
 * later is available without having to be enabled first.
 */
export const DEFAULT_DISABLED_MODELS = []

export function normalizeDisabledModels(raw) {
  if (!Array.isArray(raw)) return []
  const names = new Set()
  for (const entry of raw) {
    const name = String(entry ?? '').trim()
    if (name) names.add(name)
  }
  return [...names]
}

// The splash lives outside the settings blob so that clearing the saved
// settings does not silently bring the welcome screen back.
export const SPLASH_STORAGE_KEY = 'showSplashOnStartup'
export const DEFAULT_SHOW_SPLASH = true

// Same reasoning as the splash: a notice dismissed for good should stay
// dismissed even after the settings are cleared.
export const IMPORT_NOTICE_STORAGE_KEY = 'showImportNotice'
export const DEFAULT_SHOW_IMPORT_NOTICE = true

/**
 * Every "do not show again" flag, so the advanced settings can put them all
 * back at once. A notice that can be dismissed forever is otherwise gone for
 * good — the splash is not in here because it keeps its own entry in the menu.
 *
 * Restoring is a removal rather than a write of the default: the absence of
 * the key is what a fresh install looks like.
 */
export const DISMISSIBLE_NOTICE_KEYS = [IMPORT_NOTICE_STORAGE_KEY]

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

export const MODERATOR_MODES = ['containment', 'facilitator', 'active']

/**
 * The style a moderator runs in unless it was given one of its own.
 *
 * Lives here rather than on `Debate` because the prompt builder needs the same
 * answer and cannot import the debate without a cycle — it used to carry its
 * own copy of this list and this fallback, which is two places to change a
 * default and one of them to forget.
 */
export const DEFAULT_MODERATOR_MODE = 'facilitator'

/** Migrates the legacy moderatorAlwaysIntervene boolean into the mode select. */
export function normalizeModeratorMode(participant) {
  const mode = participant?.moderatorMode
  if (MODERATOR_MODES.includes(mode)) return mode
  return participant?.moderatorAlwaysIntervene ? 'active' : DEFAULT_MODERATOR_MODE
}

// How many rounds pass between two scheduled facilitation turns. Only the
// facilitator style uses it: 1 means the moderator sums up every round.
export const DEFAULT_MODERATOR_FACILITATION_INTERVAL = 1
export const MIN_MODERATOR_FACILITATION_INTERVAL = 1
export const MAX_MODERATOR_FACILITATION_INTERVAL = 6
export const MIN_MODERATION_COOLING = 0.01
export const MAX_MODERATION_COOLING = 1
export const MODERATION_COOLING_STEPS = [0.05, 0.1, 0.15, 0.2, 0.3, 0.4]

export const SUMMARY_ACCUMULATE_STEPS = [2, 4, 8, 16, 32, 64, 128, 256]

/**
 * The context setting as a number of characters.
 *
 * The control is labelled in KB and every consumer needs the same conversion,
 * which used to be an inline `threshold * 1024` at each call site — including
 * the ones that then compared it against a limit expressed in characters.
 */
export function contextBudgetChars(thresholdKb) {
  const value = Number(thresholdKb)
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_SUMMARY_ACCUMULATE_THRESHOLD * 1024
  return Math.round(value * 1024)
}

// How much of a fetched page `fetch_url` returns per call. A page is never
// truncated — the rest stays reachable through the block number — so this is a
// context budget per call rather than a limit on what can be read.
export const DEFAULT_PAGE_BLOCK_KB = 16
export const PAGE_BLOCK_STEPS = [8, 16, 32, 64, 128, 256]
export const MIN_PAGE_BLOCK_KB = PAGE_BLOCK_STEPS[0]
export const MAX_PAGE_BLOCK_KB = PAGE_BLOCK_STEPS[PAGE_BLOCK_STEPS.length - 1]

export function normalizePageBlockKb(raw) {
  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_PAGE_BLOCK_KB
  return Math.min(MAX_PAGE_BLOCK_KB, Math.max(MIN_PAGE_BLOCK_KB, Math.round(value)))
}

/**
 * How many turns keep their debug exchanges.
 *
 * With debug on, every turn stores the full request and response of each call
 * it made — the entire system prompt and conversation, once per exchange. Over
 * a long debate that is by far the heaviest thing the session holds, and only
 * the last few are ever inspected. Older turns keep their message and lose the
 * payloads.
 */
export const DEFAULT_DEBUG_PAYLOAD_TURNS = 5
export const MIN_DEBUG_PAYLOAD_TURNS = 1
export const MAX_DEBUG_PAYLOAD_TURNS = 100

export function normalizeDebugPayloadTurns(raw) {
  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_DEBUG_PAYLOAD_TURNS
  return Math.min(MAX_DEBUG_PAYLOAD_TURNS, Math.max(MIN_DEBUG_PAYLOAD_TURNS, Math.round(value)))
}

// The search key is optional. Without one the reader still answers, at 20
// requests a minute shared per IP; with one that ceiling rises and the keyed
// search backend — which refuses anonymous callers — becomes available.
export const DEFAULT_SEARCH_API_KEY = ''

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
