import { UI_STRINGS } from '../i18n/UiStrings'
import { styles } from './Style'

export default function TopicComposer({
  topic,
  topicRef,
  textareaRef,
  topicWrapRef,
  topicDropOpen,
  setTopicDropOpen,
  topicHistory,
  running,
  messages,
  canStart,
  allModelsSet,
  ollamaOk,
  setTopic,
  flushTopic,
  setTopicValue,
  handleStart,
  handleResume,
  handleInterjection,
  removeHistoryEntry,
}) {
  const ui = UI_STRINGS.app

  return (
    <div ref={topicWrapRef} style={{ position: 'relative', flex: 1, display: 'flex' }}>
      <textarea
        ref={textareaRef}
        style={{ ...styles.textarea, flex: 1 }}
        defaultValue={topic}
        onChange={event => {
          topicRef.current = event.target.value
          if (running) setTopic(event.target.value)
          if (event.target.value && topicDropOpen) setTopicDropOpen(false)
        }}
        onBlur={flushTopic}
        onFocus={() => {
          if (messages.length === 0 && !running && topicHistory.length > 0 && !topicRef.current) setTopicDropOpen(true)
        }}
        onKeyDown={event => {
          if (event.key === 'Escape') {
            setTopicDropOpen(false)
            return
          }
          if (event.key !== 'Enter' || event.shiftKey) return

          event.preventDefault()
          const value = flushTopic()
          if (running && value.trim()) handleInterjection()
          else if (messages.length > 0) handleResume(value)
          else if (value.trim() && canStart && allModelsSet && ollamaOk) handleStart(value)
        }}
        placeholder={running ? ui.topicQueued : messages.length > 0 ? ui.topicContinue : ui.topicInitial}
        rows={1}
      />
      {topicDropOpen && messages.length === 0 && !running && topicHistory.length > 0 && (
        <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, zIndex: 200, background: '#1e1e1e', border: '1px solid #2e2e2e', borderRadius: 8, marginBottom: 4, boxShadow: '0 -4px 16px #0008', overflow: 'hidden' }}>
          {topicHistory.map((entry, index) => (
            <div key={entry} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', borderBottom: index < topicHistory.length - 1 ? '1px solid #2a2a2a' : 'none', cursor: 'pointer' }} onMouseEnter={event => { event.currentTarget.style.background = '#2a2a2a' }} onMouseLeave={event => { event.currentTarget.style.background = 'transparent' }}>
              <span style={{ flex: 1, fontSize: 13, color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} onClick={() => { setTopicValue(entry); setTopicDropOpen(false) }}>{entry}</span>
              <button onClick={event => { event.stopPropagation(); removeHistoryEntry(index) }} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 14, padding: '0 2px', lineHeight: 1, flexShrink: 0 }} title={ui.removeHistoryItem}>x</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
