import { UI_STRINGS } from '../i18n/UiStrings'

export default function AttachmentsChips({ attachments, onRemove }) {
  const ui = UI_STRINGS.app
  if (attachments.length === 0) return null

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {attachments.map((attachment, index) => (
        <div key={attachment.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#1a1a2a', border: '1px solid #3a3a6a', borderRadius: 6, padding: '3px 8px', fontSize: 11, color: '#9090cc' }}>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 2H3a1 1 0 00-1 1v7a1 1 0 001 1h6a1 1 0 001-1V5L7 2z"/><path d="M7 2v3h3"/></svg>
          <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachment.name}</span>
          {attachment.truncated && <span style={{ color: '#aa7744', fontSize: 10 }} title={ui.docTruncated}>!</span>}
          <button onClick={() => onRemove(index)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1 }}>x</button>
        </div>
      ))}
    </div>
  )
}
