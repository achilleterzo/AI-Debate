export default function PromptEstimateBadge({ estimate }) {
  if (!estimate) return null

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
    }} title={`Last prompt sent: ${estimate.totalChars} characters (~${estimate.estimatedTokens} tokens), ${estimate.messageCount} messages, model ${estimate.model}`}>
      Last request: ~{estimate.estimatedTokens} tok · {estimate.model}
    </div>
  )
}
