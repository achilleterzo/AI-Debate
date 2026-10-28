import StackedSlider from './StackedSlider'
import { DEFAULT_TEMPERATURE, TEMPERATURE_MAX, TEMPERATURE_MIN, TEMPERATURE_STEP, normalizeTemperature, temperatureBand } from '../settings/Temperature'

/**
 * The participant's temperature. The neutral position is stored as no choice,
 * so a participant left there keeps the provider's own temperature; a double
 * click returns to it.
 */
export default function TemperatureSlider({ value, onCommit, levels, title }) {
  return (
    <StackedSlider
      width={150}
      title={title}
      value={normalizeTemperature(value) ?? DEFAULT_TEMPERATURE}
      resetValue={DEFAULT_TEMPERATURE}
      text={draft => `${levels[temperatureBand(draft)]} · ${draft.toFixed(2)}`}
      color={draft => (normalizeTemperature(draft) != null ? 'var(--c-f59e0b, #f59e0b)' : 'var(--c-666666, #666)')}
      min={TEMPERATURE_MIN} max={TEMPERATURE_MAX} step={TEMPERATURE_STEP}
      onCommit={next => onCommit(normalizeTemperature(next))}
    />
  )
}
