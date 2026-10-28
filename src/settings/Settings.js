import { AUTO_SEARCH_ENGINE, SEARCH_ENGINE_IDS } from '../../electron/web/engines/catalog.js'

export const DEFAULT_URL = 'http://localhost:11434'
export const DEFAULT_PROVIDER_ID = 'ollama'

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
export const MODEL_PROVIDER_IDS = ['ollama', 'ollama-cloud', 'openrouter', 'gemini', 'codex', 'claude']

/** The providers whose API key the app stores, encrypted, for the user. */
export const KEY_PROVIDER_IDS = ['ollama-cloud', 'openrouter', 'gemini']

/**
 * Provider ids as they were once written, and what they are called now.
 *
 * The Codex client was filed under the vendor's name before OpenRouter and
 * Gemini arrived and made "OpenAI" ambiguous. Saved settings, saved sessions
 * and exported files all carry the old id, so it is translated on the way in
 * rather than left to resolve to no provider at all.
 */
const LEGACY_PROVIDER_IDS = { openai: 'codex' }

export function normalizeProviderId(raw) {
  const id = String(raw ?? '').trim()
  const current = LEGACY_PROVIDER_IDS[id] ?? id
  return MODEL_PROVIDER_IDS.includes(current) ? current : ''
}

export function normalizeDisabledModels(raw) {
  if (!Array.isArray(raw)) return []
  const names = new Set()
  for (const entry of raw) {
    const name = String(entry ?? '').trim()
    if (name) names.add(name)
  }
  return [...names]
}

/**
 * The reasoning levels a provider default may hold. Same list as
 * `Debate.THINKING_LEVELS`, repeated because the debate imports this module.
 */
export const PROVIDER_THINKING_LEVELS = ['none', 'low', 'medium', 'high', 'max']

/**
 * The levels each provider actually accepts, in the app's own vocabulary.
 *
 * Asking for a level a provider has no name for is not a softer request, it is
 * a rejected one: the hosted OpenAI-compatible APIs stop at `high`, Ollama has
 * no step above it either, and only the coding clients reason harder than that
 * — Claude up to `max`, Codex to the effort it calls `xhigh`. Claude has no
 * way to switch reasoning off through its client, so `none` there is simply
 * the least it will do.
 */
export const PROVIDER_THINKING_LEVEL_OPTIONS = {
  ollama: ['none', 'low', 'medium', 'high'],
  'ollama-cloud': ['none', 'low', 'medium', 'high'],
  openrouter: ['none', 'low', 'medium', 'high'],
  gemini: ['none', 'low', 'medium', 'high'],
  codex: ['none', 'low', 'medium', 'high', 'max'],
  claude: ['none', 'low', 'medium', 'high', 'max'],
}

export function providerThinkingLevelOptions(providerId) {
  return PROVIDER_THINKING_LEVEL_OPTIONS[providerId] ?? PROVIDER_THINKING_LEVELS
}

/**
 * The nearest level the provider offers. A level it does not have falls to the
 * highest one it does, so a participant carried over from another provider
 * keeps asking for as much reasoning as that provider can give.
 */
export function clampThinkingLevel(providerId, level) {
  const options = providerThinkingLevelOptions(providerId)
  if (options.includes(level)) return level
  const wanted = PROVIDER_THINKING_LEVELS.indexOf(level)
  if (wanted < 0) return options[0]
  return [...options].reverse().find(option => PROVIDER_THINKING_LEVELS.indexOf(option) <= wanted) ?? options[0]
}

/**
 * Generation parameters, per provider, in the app's own names.
 *
 * Every one of them is optional and empty means "whatever the model does by
 * itself" — the same as not sending the field at all, which is what the
 * providers do with it. They are stored per provider because none of them is
 * portable: a context window that fits a local model is not the one a hosted
 * frontier model wants, and only Ollama can be asked to keep a model loaded.
 */
export const PROVIDER_OPTION_FIELDS = {
  ollama: ['temperature', 'numPredict', 'numCtx', 'keepAlive'],
  'ollama-cloud': ['temperature', 'numPredict', 'numCtx'],
  openrouter: ['temperature', 'numPredict'],
  gemini: ['temperature', 'numPredict'],
  codex: ['sandbox'],
  claude: [],
}

export const CODEX_SANDBOXES = ['read-only', 'workspace-write', 'danger-full-access']
export const DEFAULT_CODEX_SANDBOX = 'read-only'

const OPTION_RANGES = {
  temperature: { min: 0, max: 2, whole: false },
  numPredict: { min: 1, max: 131072, whole: true },
  numCtx: { min: 512, max: 1048576, whole: true },
}

function normalizeOptionNumber(field, raw) {
  const range = OPTION_RANGES[field]
  if (raw === '' || raw == null) return ''
  const value = range.whole ? Math.round(Number(raw)) : Number(raw)
  if (!Number.isFinite(value)) return ''
  return Math.min(range.max, Math.max(range.min, value))
}

/** `30s`, `10m`, `-1` to keep it loaded, `0` to unload at once — or empty. */
function normalizeKeepAlive(raw) {
  const value = String(raw ?? '').trim()
  return /^-?\d+(?:[smh])?$/.test(value) ? value : ''
}

export function normalizeProviderOptions(providerId, raw) {
  const fields = PROVIDER_OPTION_FIELDS[providerId] ?? []
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  return Object.fromEntries(fields.map(field => {
    if (field === 'keepAlive') return [field, normalizeKeepAlive(source[field])]
    if (field === 'sandbox') return [field, CODEX_SANDBOXES.includes(source[field]) ? source[field] : DEFAULT_CODEX_SANDBOX]
    return [field, normalizeOptionNumber(field, source[field])]
  }))
}

/**
 * The options as a request carries them: only what was actually set, so an
 * empty field stays absent rather than being sent as a zero.
 */
export function providerRequestOptions(providerId, options) {
  return Object.fromEntries(Object.entries(normalizeProviderOptions(providerId, options)).filter(([, value]) => value !== '' && value != null))
}

/**
 * Per provider: the default model, the models switched off, and the reasoning
 * level participants on that provider follow unless they picked their own.
 *
 * The level is per provider because a sensible default is not portable: "max"
 * on a local 8B model and "max" on a hosted frontier model are different
 * requests, and switching the default provider must not carry one over to the
 * other. A missing level is left out rather than invented, so the caller can
 * fall back to the level saved before providers had their own.
 */
export function normalizeProviderModelSettings(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  // Entries saved under a provider's former id are read under its current one;
  // an entry already saved under the current id is the one that wins.
  const byProvider = {}
  for (const [savedId, entry] of Object.entries(raw)) {
    const providerId = normalizeProviderId(savedId)
    if (providerId && !(savedId !== providerId && byProvider[providerId])) byProvider[providerId] = entry
  }
  return Object.fromEntries(MODEL_PROVIDER_IDS.flatMap(providerId => {
    const entry = byProvider[providerId]
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return []
    return [[providerId, {
      defaultModel: String(entry.defaultModel ?? '').trim(),
      disabledModels: normalizeDisabledModels(entry.disabledModels),
      options: normalizeProviderOptions(providerId, entry.options),
      ...(PROVIDER_THINKING_LEVELS.includes(entry.defaultThinkingLevel)
        ? { defaultThinkingLevel: clampThinkingLevel(providerId, entry.defaultThinkingLevel) }
        : {}),
    }]]
  }))
}

/** Each provider's default reasoning level, for resolving participants on any provider. */
export function providerThinkingLevels(providerModelSettings, fallback) {
  return Object.fromEntries(MODEL_PROVIDER_IDS.map(providerId => [
    providerId,
    providerModelSettings?.[providerId]?.defaultThinkingLevel ?? fallback,
  ]))
}

/**
 * The model lists last retrieved per provider.
 *
 * Listing is a request — for the desktop clients a process spawn that can take
 * seconds — so without a cache every reload left the pickers of participants on
 * other providers empty until that provider answered again. The cache is only
 * what is shown meanwhile: every provider in use is still listed afresh.
 */
export const PROVIDER_MODEL_CACHE_STORAGE_KEY = 'providerModelCache'

export function normalizeProviderModelCache(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const byProvider = {}
  for (const [savedId, list] of Object.entries(raw)) {
    const providerId = normalizeProviderId(savedId)
    if (providerId && !(savedId !== providerId && byProvider[providerId])) byProvider[providerId] = list
  }
  return Object.fromEntries(MODEL_PROVIDER_IDS.flatMap(providerId => {
    const list = byProvider[providerId]
    if (!Array.isArray(list)) return []
    return [[providerId, [...new Set(list.map(entry => String(entry ?? '').trim()).filter(Boolean))]]]
  }))
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
export const MODERATION_COOLING_STEPS = [0.05, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5]

export const SUMMARY_ACCUMULATE_STEPS = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096]

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
export const PAGE_BLOCK_STEPS = [8, 16, 32, 64, 128, 256, 512, 1024]
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

// Desktop searches are rendered by an isolated Chromium window. The engine
// list, and which of them Auto tries, lives in the shared catalog.
export { SEARCH_ENGINE_IDS }
export const DEFAULT_SEARCH_ENGINE = AUTO_SEARCH_ENGINE

export function normalizeSearchEngine(value) {
  return SEARCH_ENGINE_IDS.includes(value) ? value : DEFAULT_SEARCH_ENGINE
}

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
