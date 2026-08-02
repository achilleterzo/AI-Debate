import { useUiStrings } from '../i18n/UiStringsContext'

export default function PromptEstimateBadge({ estimate, request, onInspectRequest, compact = false }) {
  const UI_STRINGS = useUiStrings()
  if (!estimate) return null
  const ui = UI_STRINGS.app

  return (
    <button
      onClick={request ? event => { event.stopPropagation(); onInspectRequest() } : undefined}
      disabled={!request}
      style={{
      marginTop: compact ? 0 : 4,
      alignSelf: compact ? 'auto' : 'flex-end',
      fontSize: 10,
      color: '#f59e0b',
      border: '1px solid #4a3a12',
      background: '#1f1a0d',
      borderRadius: 999,
      padding: '2px 8px',
      whiteSpace: 'nowrap',
      cursor: request ? 'pointer' : 'default',
    }} title={ui.lastPromptTitle(estimate)}>
      {ui.lastPromptLabel(estimate)}
    </button>
  )
}
