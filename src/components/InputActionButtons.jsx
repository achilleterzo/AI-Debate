import { useUiStrings } from '../i18n/UiStringsContext'
import { styles } from './Style'

export default function InputActionButtons({
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
  hasTopic,
  topicRef,
  textareaRef,
  onStart,
  onStop,
  onForceStop,
  onIntervene,
  onResume,
}) {
  const UI_STRINGS = useUiStrings()
  const ui = UI_STRINGS.app

  return (
    <>
      <input
        ref={docInputRef}
        type="file"
        accept=".txt,.md,.pdf,.png,.jpg,.jpeg,.webp,.gif,.bmp,.avif,.svg"
        multiple
        style={{ display: 'none' }}
        onChange={async e => {
          const files = Array.from(e.target.files || [])
          e.target.value = ''
          await onFilesSelected(files)
        }}
      />
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
        <button style={{ ...styles.connectBtn(!canStart), minHeight: 44, alignSelf: 'flex-end', cursor: canStart ? 'pointer' : 'default' }} onClick={onStart} disabled={!canStart}>
          {ui.start}
        </button>
      )}

      {running && (
        <>
          {/* Interjecting queues text for a turn after this one, and the run is
              already ending: while it stops, the button would take input that
              never gets spoken. */}
          {!stopping && (
            <button
              style={{
                ...styles.connectBtn(false),
                minHeight: 44,
                alignSelf: 'flex-end',
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
          )}
          <button
            style={{
              ...styles.connectBtn(stopping),
              minHeight: 44,
              alignSelf: 'flex-end',
              background: stopping ? '#3f1d1d' : '#7f1d1d',
              borderColor: '#b91c1c',
              color: stopping ? '#a88' : '#fee2e2',
            }}
            onClick={onStop}
            disabled={stopping}
          >
            {stopping ? ui.stopping : ui.stop}
          </button>
          {/* The stop waits for the turn in progress to end on its own, which
              on a long answer is a long wait. This one does not wait. */}
          {stopping && (
            <button
              style={{
                ...styles.connectBtn(false),
                minHeight: 44,
                alignSelf: 'flex-end',
                background: '#7f1d1d',
                borderColor: '#ef4444',
                color: '#fee2e2',
                cursor: 'pointer',
              }}
              onClick={onForceStop}
              title={ui.forceStopTitle}
            >
              {ui.forceStop}
            </button>
          )}
        </>
      )}

      {!running && messages.length > 0 && (
        <>
          <button
            style={{ ...styles.connectBtn(!canResume), minHeight: 44, alignSelf: 'flex-end' }}
            onClick={onResume}
            disabled={!canResume}
            title={
              !allModelsSet ? ui.allParticipantsNeedModel
              : !ollamaOk ? ui.ollamaUnreachable
              : hasTopic ? ui.resumeWithInterjection
              : ui.resumePingPong
            }
          >
            {messages.some(m => m.role === 'error') ? ui.resumePingPong : hasTopic ? ui.continueWithPrompt : ui.continue}
          </button>
        </>
      )}

    </>
  )
}
