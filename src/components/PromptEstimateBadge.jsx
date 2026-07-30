import { useUiStrings } from '../i18n/UiStringsContext'

export default function PromptEstimateBadge({ estimate }) {
  const UI_STRINGS = useUiStrings()
  if (!estimate) return null
  const ui = UI_STRINGS.app

  return (
    <div style={{
      marginTop: 4,
      alignSelf: 'flex-end',
      fontSize: 10,
      color: '#f59e0b',
      border: '1px solid #4a3a12',
      background: '#1f1a0d',
      borderRadius: 999,
      padding: '2px 8px',
      whiteSpace: 'nowrap',
    }} title={ui.lastPromptTitle(estimate)}>
      {ui.lastPromptLabel(estimate)}
    </div>
  )
}
