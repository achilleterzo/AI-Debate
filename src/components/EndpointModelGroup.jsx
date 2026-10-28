import ReactSelect from 'react-select'
import { useUiStrings } from '../i18n/UiStringsContext'
import { modelSelectStyles } from './Style'
import { AI } from '../services/AI'
import { PROVIDER_LOGOS, providerLabel } from './ProviderCatalog'
import ProviderLogo from './ProviderLogo'

const ENDPOINT_STATE_COLORS = { ok: 'var(--c-4ade80, #4ade80)', err: 'var(--c-f87171, #f87171)', checking: 'var(--c-f59e0b, #f59e0b)' }


/**
 * Provider button and model select joined into one input group: the button is
 * the left cap of the select rather than a control of its own.
 *
 * The provider icon opens the shared connection/settings dialog scoped to the
 * participant. A custom local endpoint can still carry its reachability badge
 * — green reachable, red unreachable, amber while checking.
 */
export default function EndpointModelGroup({
  models = [],
  providerId = '',
  defaultProviderId = 'ollama',
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
  const effectiveProviderId = providerId || defaultProviderId
  const label = providerLabel(effectiveProviderId)

  // An empty model already means "fall back to the default"; this makes that
  // state an explicit choice instead of something reachable only by clearing.
  // The default named here is always the general one — a participant that took
  // a provider of its own left the general default behind, and choosing it
  // again means coming back to it, provider included.
  const defaultModelOption = {
    value: '',
    label: defaultModel
      ? `${participantsUi.useDefaultModel} · ${defaultModel}`
      : participantsUi.useDefaultModelUnset,
  }
  // On a provider of its own, no model is not "the default": that participant
  // has nothing to run and the debate will not start, so the control says so
  // instead of showing a default that belongs to another provider.
  const onOwnProvider = !!providerId && providerId !== defaultProviderId

  const orderedModels = AI.orderModels(models, { defaultModel })
  const cloud = orderedModels.filter(entry => entry.endsWith('cloud'))
  const local = orderedModels.filter(entry => !entry.endsWith('cloud'))
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
          : `${label} · AI Providers`}
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
          borderColor: providerId || hasOverride ? 'var(--c-2f4f6f, #2f4f6f)' : 'var(--c-2e2e2e, #2e2e2e)',
          background: providerId || hasOverride ? 'var(--c-152131, #152131)' : 'var(--c-161616, #161616)',
          color: providerId || hasOverride ? 'var(--c-9ac8ff, #9ac8ff)' : 'var(--c-666666, #666)',
          cursor: disabled ? 'default' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          flexShrink: 0,
        }}
      >
        <ProviderLogo src={PROVIDER_LOGOS[effectiveProviderId]} size={26} padding={effectiveProviderId === 'claude' ? 4 : '3px 5px'} />
        {effectiveProviderId === 'ollama-cloud' && <span aria-hidden="true" style={{ position: 'absolute', right: 1, bottom: 0, fontSize: 8, lineHeight: 1, color: 'var(--c-9ac8ff, #9ac8ff)', textShadow: '0 0 2px var(--c-000000, #000)' }}>☁</span>}
        {badgeColor && (
          <span style={{ position: 'absolute', right: 2, top: 2, width: 6, height: 6, borderRadius: '50%', background: badgeColor, boxShadow: '0 0 0 1px var(--c-111111, #111)' }} />
        )}
      </button>
      <ReactSelect
        styles={groupedModelSelectStyles}
        options={options}
        value={model ? { value: model, label: model } : onOwnProvider ? null : defaultModelOption}
        onChange={opt => onModelChange?.(opt?.value ?? '')}
        placeholder={common.chooseModel}
        isDisabled={disabled}
        menuPlacement="auto"
        noOptionsMessage={() => noOptionsMessage ?? common.noModels}
      />
    </div>
  )
}
