import ReactSelect from 'react-select'
import { useUiStrings } from '../i18n/UiStringsContext'
import { modelSelectStyles } from './Style'

const ENDPOINT_STATE_COLORS = { ok: '#4ade80', err: '#f87171', checking: '#f59e0b' }

/**
 * Endpoint button and model select joined into one input group: the button is
 * the left cap of the select rather than a control of its own.
 *
 * The button is active (blue) only when a custom endpoint is set, and only
 * then does it carry the reachability badge — green reachable, red
 * unreachable, amber while checking. With no endpoint it stays grey and shows
 * no dot at all, so the badge always means something.
 */
export default function EndpointModelGroup({
  models = [],
  model = '',
  onModelChange,
  defaultModel = '',
  endpointOverride = '',
  endpointState = '',
  onConfigureEndpoint,
  disabled = false,
  noOptionsMessage,
  minWidth = 0,
}) {
  const UI_STRINGS = useUiStrings()
  const common = UI_STRINGS.common
  const participantsUi = UI_STRINGS.participants

  // An empty model already means "fall back to the default"; this makes that
  // state an explicit choice instead of something reachable only by clearing.
  const defaultModelOption = {
    value: '',
    label: defaultModel
      ? `${participantsUi.useDefaultModel} · ${defaultModel}`
      : participantsUi.useDefaultModelUnset,
  }

  const cloud = models.filter(entry => entry.endsWith('cloud')).sort()
  const local = models.filter(entry => !entry.endsWith('cloud')).sort()
  const options = [
    defaultModelOption,
    ...(cloud.length ? [{ label: common.cloud, options: cloud.map(entry => ({ value: entry, label: entry })) }] : []),
    ...(local.length ? [{ label: common.local, options: local.map(entry => ({ value: entry, label: entry })) }] : []),
  ]

  const hasOverride = !!endpointOverride?.trim()
  const badgeColor = hasOverride ? ENDPOINT_STATE_COLORS[endpointState] : null

  // Left edge squared off so the two controls read as one; the dropdown menu
  // keeps its own full radius.
  const groupedModelSelectStyles = {
    ...modelSelectStyles,
    control: (base, state) => ({
      ...modelSelectStyles.control(base, state),
      borderRadius: '0 6px 6px 0',
    }),
  }

  return (
    <div style={{ display: 'flex', alignItems: 'stretch', flex: 1, minWidth }}>
      <button
        onClick={() => !disabled && onConfigureEndpoint?.()}
        disabled={disabled}
        title={hasOverride
          ? participantsUi.customEndpointTitle(endpointOverride, endpointState ? { state: endpointState } : null)
          : participantsUi.configureCustomEndpoint}
        style={{
          width: 28,
          minHeight: 28,
          borderRadius: '6px 0 0 6px',
          // Longhands only: mixing `border` with `borderRight` makes React warn
          // about conflicting style properties on re-render. The right edge is
          // dropped because the select draws it, so the group shows one border
          // line instead of two stacked ones.
          borderWidth: '1px 0 1px 1px',
          borderStyle: 'solid',
          borderColor: hasOverride ? '#2f4f6f' : '#2e2e2e',
          background: hasOverride ? '#152131' : '#161616',
          color: hasOverride ? '#9ac8ff' : '#666',
          cursor: disabled ? 'default' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          flexShrink: 0,
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20" />
          <path d="M12 2c3 3 4 6 4 10s-1 7-4 10c-3-3-4-6-4-10s1-7 4-10z" />
        </svg>
        {badgeColor && (
          <span style={{ position: 'absolute', right: 2, top: 2, width: 6, height: 6, borderRadius: '50%', background: badgeColor, boxShadow: '0 0 0 1px #111' }} />
        )}
      </button>
      <ReactSelect
        styles={groupedModelSelectStyles}
        options={options}
        value={model ? { value: model, label: model } : defaultModelOption}
        onChange={opt => onModelChange?.(opt?.value ?? '')}
        placeholder={common.chooseModel}
        isDisabled={disabled}
        menuPlacement="auto"
        noOptionsMessage={() => noOptionsMessage ?? common.noModels}
      />
    </div>
  )
}
