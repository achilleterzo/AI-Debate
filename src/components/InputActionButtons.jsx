import { UI_STRINGS } from '../i18n/UiStrings'
import { styles } from './Style'

export default function InputActionButtons({
  globalConstraints,
  onAddGlobalConstraint,
  attachedDocs,
  docInputRef,
  onFilesSelected,
  running,
  stopping,
  messages,
  canStart,
  canResume,
  allModelsSet,
  ollamaOk,
  topic,
  topicRef,
  textareaRef,
  onStart,
  onStop,
  onIntervene,
  onResume,
  onReset,
}) {
  const ui = UI_STRINGS.app

  return (
    <>
      <input
        ref={docInputRef}
        type="file"
        accept=".txt,.md,.pdf"
        multiple
        style={{ display: 'none' }}
        onChange={async e => {
          const files = Array.from(e.target.files || [])
          e.target.value = ''
          await onFilesSelected(files)
        }}
      />
      <button
        title={ui.addGlobalConstraint}
        onClick={onAddGlobalConstraint}
        style={{
          background: globalConstraints.length > 0 ? '#24192d' : '#161616',
          border: `1px solid ${globalConstraints.length > 0 ? '#6a3b87' : '#2e2e2e'}`,
          borderRadius: 8,
          width: 44,
          height: 44,
          padding: 0,
          cursor: 'pointer',
          color: globalConstraints.length > 0 ? '#caa9ee' : '#555',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0,
          position: 'relative',
          transition: 'all 0.15s',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 4h10M3 8h10M3 12h10"/>
          <circle cx="6" cy="4" r="1.4" fill="currentColor" stroke="none"/>
          <circle cx="10" cy="8" r="1.4" fill="currentColor" stroke="none"/>
          <circle cx="7" cy="12" r="1.4" fill="currentColor" stroke="none"/>
        </svg>
        {globalConstraints.length > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            minWidth: 16, height: 16, borderRadius: 999,
            background: '#6a3b87', border: '1px solid #8f5bb3',
            color: '#f3e8ff', fontSize: 10, lineHeight: '14px', fontWeight: 700,
            padding: '0 4px',
          }}>{globalConstraints.length}</span>
        )}
      </button>
      <button
        title={ui.attachDocument}
        onClick={() => docInputRef.current?.click()}
        style={{
          background: attachedDocs.length > 0 ? '#1a1a3a' : '#161616',
          border: `1px solid ${attachedDocs.length > 0 ? '#4a4aaa' : '#2e2e2e'}`,
          borderRadius: 8,
          width: 44,
          height: 44,
          padding: 0,
          cursor: 'pointer',
          color: attachedDocs.length > 0 ? '#8888dd' : '#555',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0,
          position: 'relative',
          transition: 'all 0.15s',
        }}
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13.5 8.5l-5.5 5.5a4 4 0 01-5.657-5.657l6-6a2.5 2.5 0 013.535 3.536l-6.007 6a1 1 0 01-1.414-1.414l5.5-5.5"/>
        </svg>
        {attachedDocs.length > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            minWidth: 16, height: 16, borderRadius: 999,
            background: '#4a4aaa', border: '1px solid #6a6ad6',
            color: '#eef2ff', fontSize: 10, lineHeight: '14px', fontWeight: 700,
            padding: '0 4px',
          }}>{attachedDocs.length}</span>
        )}
      </button>

      {!running && messages.length === 0 && (
        <button style={{ ...styles.connectBtn(!canStart), minHeight: 44, alignSelf: 'stretch' }} onClick={onStart} disabled={!canStart}>
          Avvia
        </button>
      )}

      {running && (
        <>
          <button
            style={{
              ...styles.connectBtn(false),
              minHeight: 44,
              alignSelf: 'stretch',
              background: '#334155',
              color: '#e0e0e0',
              cursor: 'pointer',
            }}
            onClick={() => {
              const txt = (topicRef.current || '').trim()
              if (!txt) {
                textareaRef.current?.focus()
                return
              }
              onIntervene()
            }}
            title={ui.queueCurrentText}
          >
            {ui.intervene}
          </button>
          <button
            style={{ ...styles.connectBtn(stopping), minHeight: 44, alignSelf: 'stretch' }}
            onClick={onStop}
            disabled={stopping}
          >
            {stopping ? 'In arresto…' : 'Stop'}
          </button>
        </>
      )}

      {!running && messages.length > 0 && (
        <>
          <button
            style={{ ...styles.connectBtn(!canResume), minHeight: 44, alignSelf: 'stretch' }}
            onClick={onResume}
            disabled={!canResume}
            title={
              !allModelsSet ? ui.allParticipantsNeedModel
              : !ollamaOk ? ui.ollamaUnreachable
              : topic.trim() ? ui.resumeWithInterjection
              : ui.resumePingPong
            }
          >
            {messages.some(m => m.role === 'error') ? ui.resume : topic.trim() ? ui.continueWithPrompt : ui.continue}
          </button>
          <button style={{ ...styles.connectBtn(false), minHeight: 44, alignSelf: 'stretch' }} onClick={onReset}>
            {ui.resetButton}
          </button>
        </>
      )}
    </>
  )
}
