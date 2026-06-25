import { UI_STRINGS } from '../i18n/UiStrings'

export default function UserInputBox({ actor, onSend, onSkip, userInputRef }) {
  const ui = UI_STRINGS.userInput
  const common = UI_STRINGS.common
  const side = actor ? (actor.id % 2 === 0 ? 'flex-start' : 'flex-end') : 'flex-end'
  const bubble = {
    background: actor?.bg ?? '#1e1e1e',
    border: `1px solid ${actor?.border ?? '#444'}`,
    borderRadius: actor?.radiusOwn ?? '8px',
    padding: '10px 14px', fontSize: 14, lineHeight: 1.65,
    color: '#e0e0e0', boxSizing: 'border-box', width: '100%',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: actor?.label ?? '#f97316', marginBottom: 4, textTransform: 'uppercase', alignSelf: side }}>
        {actor?.name || actor?.tag} · 👤 {common.user}
      </div>
      <div style={{ width: '82%', alignSelf: side }}>
        <div style={bubble}>
          <textarea
            autoFocus
            rows={2}
            onChange={e => { userInputRef.current = e.target.value }}
            onInput={e => { e.target.style.height = 'auto'; e.target.style.height = `${e.target.scrollHeight}px` }}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                const txt = userInputRef.current?.trim()
                if (txt) onSend(txt)
              }
            }}
            placeholder="Write your response... (Ctrl+Enter to send)"
            style={{
              width: '100%', boxSizing: 'border-box', background: 'transparent',
              border: 'none', borderBottom: '1px solid #444', borderRadius: 0,
              color: '#eee', fontSize: 14, resize: 'none', fontFamily: 'inherit',
              padding: '2px 0', lineHeight: 1.65, outline: 'none', overflow: 'hidden',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 8 }}>
            <button onClick={onSkip} style={{ background: 'transparent', color: '#666', border: '1px solid #444', borderRadius: 6, padding: '5px 14px', cursor: 'pointer', fontSize: 13 }}>{ui.skip}</button>
            <button onClick={() => { const txt = userInputRef.current?.trim(); if (txt) onSend(txt) }} style={{ background: '#3a6a3a', color: '#eee', border: 'none', borderRadius: 6, padding: '5px 16px', cursor: 'pointer', fontSize: 13 }}>{ui.send}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
