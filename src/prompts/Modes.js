// Debate modes describe the shared purpose of the exchange. They are kept
// separate from moods because a mode applies to the whole table, while a mood
// remains an individual participant behaviour.
//
// Everything about a mode lives in a single block below:
//   instruction — injected in every participant turn (see DebateModePrompt.js);
//                 null means "no specialized procedure" (Free mode).
//   conclusion  — steers summaries, verdicts and the other closing outputs.
// Prompt text is written as separate clauses joined with a single space, so a
// long instruction can be edited line by line without producing one unreadable
// string. Order matters: it is the order shown in the mode selector.

import { normalizeModerationCooling } from '../settings/Settings'
import { DEFAULT_ENABLED_TOOLS, TOOL_SETTINGS } from '../tools/ToolSettings'

const text = (...parts) => parts.join(' ')

const MODE_DEFINITIONS = [
  {
    id: 'free',
    emoji: '🗣️',
    instruction: null,
    conclusion: text(
      'Summarize the discussion neutrally and preserve important nuance without forcing a decision.',
    ),
  },
  {
    id: 'brainstorm',
    emoji: '💡',
    instruction: text(
      'On every turn, generate or extend several useful possibilities before judging them.',
      'Prioritize breadth, novelty, and combinations;',
      'defer rejection until ideas have been made concrete.',
    ),
    conclusion: text(
      'Preserve the breadth of ideas, group related possibilities,',
      'and defer ranking or rejection unless the discussion explicitly established criteria.',
    ),
  },
  {
    id: 'fact_check',
    emoji: '🔎',
    instruction: text(
      'On every turn, identify the factual claims that matter,',
      'classify each as verified, unsupported, disputed, or uncertain,',
      'and state what evidence or source would resolve it.',
      'Never present an unsupported claim as established.',
    ),
    conclusion: text(
      'Classify material claims as verified, unsupported, disputed, or uncertain.',
      'Identify evidence gaps and do not turn unresolved facts into a confident verdict.',
    ),
  },
  {
    id: 'investigation',
    emoji: '🕵️',
    instruction: text(
      'On every turn, advance the investigation by separating observations from inferences,',
      'connecting clues, testing inconsistencies, and keeping multiple plausible hypotheses open.',
      'State what evidence supports or weakens each hypothesis and identify the next useful lead,',
      'question, source, or verification step.',
      'Do not treat suspicion, missing evidence, or correlation as proof.',
    ),
    conclusion: text(
      'Reconstruct the evidence trail and separate established facts, inferences, hypotheses,',
      'contradictions, and unresolved questions.',
      'Rank plausible explanations by evidential support and identify the next investigative steps.',
      'Do not present an accusation or unresolved hypothesis as a finding.',
    ),
  },
  {
    id: 'design_review',
    emoji: '🧩',
    instruction: text(
      'On every turn, review the proposal against its goals and constraints.',
      'Name at least one concrete strength or risk, explain the trade-off,',
      'and propose a specific improvement or test.',
    ),
    conclusion: text(
      'Organize the result around goals, constraints, strengths, risks, trade-offs,',
      'and concrete improvements or tests.',
    ),
  },
  {
    id: 'decision',
    emoji: '⚖️',
    instruction: text(
      'On every turn, move the group toward a decision:',
      'compare options against explicit criteria, expose trade-offs,',
      'and state which option you recommend or the precise uncertainty blocking a recommendation.',
    ),
    conclusion: text(
      'Compare the options against explicit criteria and give a recommendation when justified.',
      'If not, name the precise uncertainty or missing evidence blocking the decision.',
    ),
  },
  {
    id: 'negotiation',
    emoji: '🤝',
    instruction: text(
      'On every turn, distinguish positions from underlying interests,',
      'identify what could be conceded,',
      'and propose a concrete mutually acceptable trade-off.',
      'Do not argue only to win.',
    ),
    conclusion: text(
      'Separate positions, underlying interests, concessions, agreements, and unresolved terms.',
      'Prefer a workable trade-off over declaring a winner.',
    ),
  },
  {
    id: 'red_team',
    emoji: '🛡️',
    instruction: text(
      'On every turn, attack the strongest current proposal rather than a weak version of it.',
      'Expose assumptions, vulnerabilities, counterexamples, and failure modes,',
      'and distinguish fatal flaws from fixable weaknesses.',
    ),
    conclusion: text(
      'Focus on the strongest proposal’s assumptions, vulnerabilities, counterexamples, and failure modes.',
      'Distinguish fatal flaws from fixable weaknesses and include mitigations where available.',
    ),
  },
  {
    id: 'socratic',
    emoji: '🏛️',
    instruction: text(
      'On every turn, lead with precise questions that test definitions, assumptions, evidence,',
      'implications, and contradictions.',
      'Do not rush to assert a conclusion when a question would reveal more.',
    ),
    conclusion: text(
      'Prioritize the key unanswered questions, definitions, assumptions, and evidence gaps.',
      'Keep any conclusion provisional when a question remains decisive.',
    ),
  },
  {
    id: 'peer_review',
    emoji: '📚',
    instruction: text(
      'On every turn, give rigorous but constructive peer review:',
      'assess reasoning, evidence, clarity, completeness, and reproducibility,',
      'then identify specific revisions rather than offering vague approval or rejection.',
    ),
    conclusion: text(
      'Separate strengths, major issues, minor issues, evidence quality, reproducibility,',
      'and specific revisions.',
      'Do not reduce the review to vague approval or rejection.',
    ),
  },
  {
    id: 'consensus',
    emoji: '🌐',
    instruction: text(
      'On every turn, explicitly separate agreements from unresolved disagreements,',
      'reconcile compatible views,',
      'and propose the smallest precise common position the group could accept.',
      'Never manufacture agreement.',
    ),
    conclusion: text(
      'Clearly separate genuine agreements, unresolved disagreements,',
      'and the smallest precise common position.',
      'Never manufacture consensus.',
    ),
  },
  {
    id: 'role_play',
    emoji: '🎭',
    instruction: text(
      'Treat the debate as a shared role-playing scene.',
      'Every turn must advance the fiction through an in-character action, dialogue, decision,',
      'or concrete reaction.',
      'Never replace participation with critique or meta-debate;',
      'defer world adjudication and narration to the moderator acting as Master / Narrator.',
    ),
    conclusion: text(
      'Stay inside the fiction: recap consequential events, current character/world state,',
      'established facts, open situations, and possible narrative hooks.',
      'Do not judge the moderator, analyze the debate from outside the fiction,',
      'or invent outcomes not established in the scene.',
    ),
  },
]

/**
 * The mode's English name, for the places that are not the interface.
 *
 * The interface has translated labels of its own (`UI_STRINGS.modes`), which is
 * why the label was taken off the mode definitions. What was missed is that the
 * prompts and the exports also name the mode, and they fell back to the raw id:
 * a participant was told the mode was `RED_TEAM`, a conclusion was handed
 * `debate_mode_label: "peer_review"`, and an export header read `decision`.
 * That is our storage key shown to a model and to a reader.
 */
const titleCase = id => id
  .split('_')
  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
  .join(' ')

export const DEFAULT_DEBATE_MODE = 'free'
const DEFAULT_CUSTOM_EMOJI = '🧭'
const BUILTIN_BY_ID = Object.fromEntries(MODE_DEFINITIONS.map(mode => [mode.id, mode]))

// ── user configuration ─────────────────────────────────────────────────────
//
// What the user can do to the list: reorder it, switch a mode off, rewrite what
// a built-in says, give it settings of its own, or add modes of their own. It is
// stored as an ordered array of entries (the order is the selector's order):
//
//   id, custom, enabled
//   name, emoji          '' means the built-in's own
//   instruction          what every participant is told each turn
//   conclusion           what steers summaries and the closing outputs
//   settings             general settings this mode replaces while it is active
//   personalityInstructions   the participants' general rules, replaced for this mode
//
// Built-in text is only stored when the user changed it, so a later improvement
// to a default still reaches everyone who did not touch it.

/** The general settings a mode may replace, and how each is validated. */
export const MODE_SETTING_KEYS = ['maxTurns', 'useSummary', 'dynamicAffinity', 'randomTurnOrder', 'moderationCooling', 'enabledTools']

export const MAX_ROUNDS_LIMIT = 999

function normalizeModeSettings(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const settings = {}
  if (source.maxTurns != null) {
    const value = Number(source.maxTurns)
    if (Number.isFinite(value)) settings.maxTurns = Math.min(MAX_ROUNDS_LIMIT, Math.max(0, Math.round(value)))
  }
  for (const key of ['useSummary', 'dynamicAffinity', 'randomTurnOrder']) {
    if (typeof source[key] === 'boolean') settings[key] = source[key]
  }
  if (source.moderationCooling != null) settings.moderationCooling = normalizeModerationCooling(source.moderationCooling)
  if (source.enabledTools && typeof source.enabledTools === 'object') {
    const tools = Object.fromEntries(TOOL_SETTINGS.filter(tool => typeof source.enabledTools[tool.id] === 'boolean').map(tool => [tool.id, source.enabledTools[tool.id]]))
    if (Object.keys(tools).length) settings.enabledTools = tools
  }
  return settings
}

// Kept as typed: trimming here would eat a space the moment it is entered. The
// registry trims what it hands out.
const cleanText = value => (typeof value === 'string' ? value : '')

function normalizeModeEntry(raw, builtin) {
  const instruction = cleanText(raw.instruction)
  const conclusion = cleanText(raw.conclusion)
  return {
    id: raw.id,
    custom: !builtin,
    enabled: raw.enabled !== false,
    name: cleanText(raw.name).slice(0, 60),
    emoji: cleanText(raw.emoji).trim().slice(0, 8),
    // A built-in keeps no copy of its own text: only a real change is stored.
    instruction: !instruction.trim() || (builtin && instruction.trim() === (builtin.instruction ?? '')) ? '' : instruction,
    conclusion: !conclusion.trim() || (builtin && conclusion.trim() === builtin.conclusion) ? '' : conclusion,
    settings: normalizeModeSettings(raw.settings),
    personalityInstructions: typeof raw.personalityInstructions === 'string' ? raw.personalityInstructions : null,
  }
}

const CUSTOM_ID_PATTERN = /^custom_[a-z0-9_]{1,40}$/

/** An id for a new mode of the user's, never one already in use. */
export function newCustomModeId(config) {
  const used = new Set((config ?? modesConfig).map(entry => entry.id))
  for (;;) {
    const id = `custom_${Math.random().toString(36).slice(2, 8)}`
    if (!used.has(id)) return id
  }
}

export function normalizeModesConfig(raw) {
  const entries = []
  const seen = new Set()
  for (const item of Array.isArray(raw) ? raw : []) {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' || seen.has(item.id)) continue
    const builtin = BUILTIN_BY_ID[item.id]
    if (!builtin && !CUSTOM_ID_PATTERN.test(item.id)) continue
    seen.add(item.id)
    entries.push(normalizeModeEntry(item, builtin))
  }
  // A built-in missing from the saved list (one added by an update) joins at the end.
  for (const mode of MODE_DEFINITIONS) {
    if (!seen.has(mode.id)) entries.push(normalizeModeEntry({ id: mode.id }, mode))
  }
  // Something must always be selectable; Free is the mode everything falls back to.
  if (!entries.some(entry => entry.enabled)) entries.find(entry => entry.id === DEFAULT_DEBATE_MODE).enabled = true
  return entries
}

export const DEFAULT_MODES_CONFIG = normalizeModesConfig([])

// ── the registry ───────────────────────────────────────────────────────────
//
// The mode list is read from a great many places that are not React (prompt
// builders, exporters, the conclusions), so it is a registry reconfigured from
// the settings — the same arrangement as the web service — and the exported
// collections are rebuilt in place so every existing import stays current.

let modesConfig = DEFAULT_MODES_CONFIG
const FALLBACK_CONCLUSION = BUILTIN_BY_ID[DEFAULT_DEBATE_MODE].conclusion

/** Every mode that exists, disabled ones included: a saved debate still resolves. */
export const DEBATE_MODES = []
/** The modes the selector offers: enabled ones, in the user's order. */
export const DEBATE_MODE_OPTIONS = []
export const DEBATE_MODE_CONCLUSION_INSTRUCTIONS = {}

function rebuildRegistry() {
  DEBATE_MODES.length = 0
  DEBATE_MODE_OPTIONS.length = 0
  for (const key of Object.keys(DEBATE_MODE_CONCLUSION_INSTRUCTIONS)) delete DEBATE_MODE_CONCLUSION_INSTRUCTIONS[key]
  for (const entry of modesConfig) {
    const builtin = BUILTIN_BY_ID[entry.id]
    const name = entry.name.trim()
    const mode = {
      id: entry.id,
      emoji: entry.emoji || builtin?.emoji || DEFAULT_CUSTOM_EMOJI,
      instruction: entry.instruction.trim() || builtin?.instruction || null,
      label: name || (builtin ? titleCase(entry.id) : 'Custom mode'),
      conclusion: entry.conclusion.trim() || builtin?.conclusion || FALLBACK_CONCLUSION,
      custom: entry.custom,
      enabled: entry.enabled,
      // Set only when the user named it, so an untouched built-in keeps its translation.
      name: name || null,
      settings: entry.settings,
      personalityInstructions: entry.personalityInstructions,
    }
    DEBATE_MODES.push(mode)
    DEBATE_MODE_CONCLUSION_INSTRUCTIONS[mode.id] = mode.conclusion
    if (mode.enabled) DEBATE_MODE_OPTIONS.push({ value: mode.id, emoji: mode.emoji, label: mode.label, name: mode.name, custom: mode.custom })
  }
}

export function configureModes(raw) {
  modesConfig = normalizeModesConfig(raw)
  rebuildRegistry()
  return modesConfig
}

export function getModesConfig() {
  return modesConfig
}

/** What a built-in says out of the box, for "restore" and for the editor's placeholders. */
export function builtinModeDefinition(id) {
  const builtin = BUILTIN_BY_ID[id]
  return builtin ? { emoji: builtin.emoji, instruction: builtin.instruction ?? '', conclusion: builtin.conclusion, label: titleCase(id) } : null
}

rebuildRegistry()

export function normalizeDebateMode(value) {
  return DEBATE_MODES.some(mode => mode.id === value) ? value : DEFAULT_DEBATE_MODE
}

/** The mode an id resolves to. */
export function findDebateMode(value) {
  const id = normalizeDebateMode(value)
  return DEBATE_MODES.find(mode => mode.id === id) ?? DEBATE_MODES[0]
}

/** The English name of whichever mode an id resolves to. */
export function debateModeLabel(value) {
  return findDebateMode(value).label
}

/**
 * The general settings as they apply under a mode: each one the mode replaces
 * wins, everything else is the general value. `overridden` lists what was
 * replaced, so a control can say that it is editing the mode's value.
 */
// Tools a built-in mode switches on by itself, on top of the general setting.
const MODE_TOOL_DEFAULTS = { role_play: { roll_dice: true } }

/** Whether a tool is on in this mode before any override of the mode's own. */
export function modeToolDefault(modeId, toolId, generalEnabled) {
  return MODE_TOOL_DEFAULTS[modeId]?.[toolId] ?? generalEnabled
}

export function resolveModeSettings(general, modeId) {
  const mode = findDebateMode(modeId)
  const own = mode.settings ?? {}
  const resolved = { ...general }
  resolved.enabledTools = { ...(general.enabledTools ?? DEFAULT_ENABLED_TOOLS), ...MODE_TOOL_DEFAULTS[mode.id] }
  const overridden = []
  for (const key of MODE_SETTING_KEYS) {
    if (own[key] === undefined) continue
    overridden.push(key)
    resolved[key] = key === 'enabledTools' ? { ...resolved.enabledTools, ...own.enabledTools } : own[key]
  }
  if (typeof mode.personalityInstructions === 'string') {
    resolved.generalPersonalityInstructions = mode.personalityInstructions
    overridden.push('generalPersonalityInstructions')
  }
  return { ...resolved, overridden }
}
