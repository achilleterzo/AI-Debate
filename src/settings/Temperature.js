/**
 * The participant's own sampling temperature. It is stored as the number
 * itself, or null when the participant follows the temperature configured for
 * its provider (which may itself be empty: the model's default).
 *
 * The slider that sets it is continuous; the words from "dull" to "mad" only
 * name the band the value falls in.
 */
export const TEMPERATURE_MIN = 0
export const TEMPERATURE_MAX = 2
export const TEMPERATURE_STEP = 0.05
// The neutral position: reaching it again stores no choice at all.
export const DEFAULT_TEMPERATURE = 0.8

// Upper bound of each band, in the order of the `temperatureLevels` labels.
const BAND_LIMITS = [0.35, 0.65, 1, 1.4]

export function normalizeTemperature(value) {
  if (value == null || value === '') return null
  const number = Number(value)
  if (!Number.isFinite(number)) return null
  const stepped = Math.round(Math.min(TEMPERATURE_MAX, Math.max(TEMPERATURE_MIN, number)) / TEMPERATURE_STEP) * TEMPERATURE_STEP
  const rounded = Math.round(stepped * 100) / 100
  return rounded === DEFAULT_TEMPERATURE ? null : rounded
}

/** Index into the five labels for a temperature (null means the neutral one). */
export function temperatureBand(value) {
  const temperature = normalizeTemperature(value) ?? DEFAULT_TEMPERATURE
  const index = BAND_LIMITS.findIndex(limit => temperature < limit)
  return index === -1 ? BAND_LIMITS.length : index
}
