import { DEBATE_MODES, builtinModeDefinition, newCustomModeId, normalizeModesConfig } from './Modes'

/**
 * Edits to the mode list, as pure functions over the stored configuration.
 * Every one returns a new array; the registry is reconfigured from it by the
 * settings setter, which also normalizes whatever comes back.
 */

const indexOfMode = (config, id) => config.findIndex(entry => entry.id === id)

export function updateModeEntry(config, id, patch) {
  return config.map(entry => (entry.id === id ? { ...entry, ...patch } : entry))
}

export function moveModeEntry(config, id, delta) {
  const from = indexOfMode(config, id)
  const to = from + delta
  if (from < 0 || to < 0 || to >= config.length) return config
  const next = [...config]
  next.splice(to, 0, next.splice(from, 1)[0])
  return next
}

/** Switches a mode on or off. The last enabled mode cannot be switched off. */
export function toggleModeEntry(config, id) {
  const target = config.find(entry => entry.id === id)
  if (!target) return config
  if (target.enabled && config.filter(entry => entry.enabled).length <= 1) return config
  return updateModeEntry(config, id, { enabled: !target.enabled })
}

/** A fresh mode of the user's own, appended to the list. */
export function addModeEntry(config, { name, emoji = '', instruction = '', conclusion = '' } = {}) {
  const id = newCustomModeId(config)
  const entry = { id, custom: true, enabled: true, name, emoji, instruction, conclusion, settings: {}, personalityInstructions: null }
  return { config: normalizeModesConfig([...config, entry]), id }
}

/**
 * A copy of any mode — built-in or the user's own — as a mode of its own, placed
 * right after the original with everything it currently says and does.
 */
export function duplicateModeEntry(config, id, name) {
  const source = DEBATE_MODES.find(mode => mode.id === id)
  const at = indexOfMode(config, id)
  if (!source || at < 0) return { config, id: null }
  const copyId = newCustomModeId(config)
  const copy = {
    id: copyId,
    custom: true,
    enabled: true,
    name,
    emoji: source.emoji,
    instruction: source.instruction ?? '',
    conclusion: source.conclusion,
    settings: structuredClone(source.settings ?? {}),
    personalityInstructions: source.personalityInstructions,
  }
  const next = [...config]
  next.splice(at + 1, 0, copy)
  return { config: normalizeModesConfig(next), id: copyId }
}

/** Removes one of the user's own modes. Built-ins can only be switched off. */
export function removeModeEntry(config, id) {
  const target = config.find(entry => entry.id === id)
  if (!target?.custom) return config
  return normalizeModesConfig(config.filter(entry => entry.id !== id))
}

/** A built-in back to what it says out of the box; its place in the list stays. */
export function resetModeEntry(config, id) {
  const target = config.find(entry => entry.id === id)
  if (!target || target.custom || !builtinModeDefinition(id)) return config
  return updateModeEntry(config, id, { name: '', emoji: '', instruction: '', conclusion: '', settings: {}, personalityInstructions: null })
}

/**
 * Whether a mode is exactly what the application ships. The list's order and
 * on/off state are layout, not content, so they do not count.
 */
export function isModeCustomized(entry) {
  return !!(entry.name.trim() || entry.emoji || entry.instruction.trim() || entry.conclusion.trim()
    || Object.keys(entry.settings ?? {}).length || typeof entry.personalityInstructions === 'string')
}
