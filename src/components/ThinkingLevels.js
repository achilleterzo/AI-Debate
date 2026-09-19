import { Debate } from '../debate/Debate'

/**
 * The five native reasoning levels as select options.
 *
 * Shared by the provider default in the AI Providers dialog and the per-participant
 * picker so the two always offer the same list, labelled the same way.
 */
export function thinkingLevelOptions(participantsUi) {
  const labels = {
    none: participantsUi.thinkingNone,
    low: participantsUi.thinkingLow,
    medium: participantsUi.thinkingMedium,
    high: participantsUi.thinkingHigh,
    max: participantsUi.thinkingMax,
  }
  return Debate.THINKING_LEVELS.map(value => ({ value, label: labels[value] }))
}

export function thinkingLevelLabel(participantsUi, level) {
  const normalized = Debate.normalizeThinkingLevel(level)
  return thinkingLevelOptions(participantsUi).find(option => option.value === normalized)?.label ?? normalized
}
