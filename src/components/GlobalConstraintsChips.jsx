import { UI_STRINGS } from '../i18n/UiStrings'

export default function GlobalConstraintsChips({ constraints, onEdit, onDelete }) {
  if (constraints.length === 0) return null

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {constraints.map((constraint, index) => (
        <div key={`${constraint}-${index}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#1f1726', border: '1px solid #4a2f63', borderRadius: 6, padding: '3px 8px', fontSize: 11, color: '#caa9ee', maxWidth: 420 }} title={constraint}>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h4M3.5 6h5M4 8h4"/><rect x="1.5" y="1.5" width="9" height="9" rx="1.5"/></svg>
          <button onClick={() => onEdit(index)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }} title={UI_STRINGS.participants.editConstraint}>{constraint}</button>
          <button onClick={() => onDelete(index)} style={{ background: 'none', border: 'none', color: '#7f629d', cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1 }}>x</button>
        </div>
      ))}
    </div>
  )
}
