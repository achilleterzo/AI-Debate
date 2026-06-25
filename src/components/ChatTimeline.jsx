import { marked } from 'marked'
import { styles } from './Style'
import { buildOrderedItems } from '../utils/Sorting'
import { UI_STRINGS } from '../i18n/UiStrings'

function normalizeMathShorthands(text) {
  let out = String(text || '')
  out = out.replace(/\$\s*\\rightarrow\s*\$/g, '→')
  out = out.replace(/\$\s*\\leftarrow\s*\$/g, '←')
  out = out.replace(/\$\s*\\Rightarrow\s*\$/g, '⇒')
  out = out.replace(/\$\s*\\Leftarrow\s*\$/g, '⇐')
  out = out.replace(/\$\s*\\leftrightarrow\s*\$/g, '↔')
  return out
}

function looksLikeModerationIntervention(text) {
  const t = String(text || '').toLowerCase()
  if (!t.trim()) return false
  if (/\b(direttiva|prossimo\s+turno|moderazione)\b/.test(t)) return true
  if (/\b(directive|next\s+turn|moderation)\b/.test(t)) return true
  if (/\b(intervento|intervention)\s*:/.test(t)) return true
  if (/\b1\)|2\)|3\)/.test(t) && /\b(deve|must|should|focus|focalizza)\b/.test(t)) return true
  return false
}

export default function ChatTimeline({
  messages,
  running,
  conclusions,
  conclusionTypes,
  participants,
  markedInline,
  streamingRole,
  streamingSeq,
  copiedIdx,
  setCopiedIdx,
  setConclusions,
  setPayloadModal,
  userModel,
  moods,
  moodIntensity,
  defaultMoodIntensity,
  DotsComponent: Dots,
  onResume,
  is2xlLayout,
}) {
  const ui = UI_STRINGS.chat
  const common = UI_STRINGS.common
  if (messages.length === 0 && !running) {
    return <div style={styles.empty}>{ui.empty}</div>
  }

  const items = buildOrderedItems(messages, conclusions, {
    includeMessageIndex: true,
    includeConclusionIndex: true,
  })

  const elems = []
  let lastTurn = null
  const regularBalloonMaxWidth = is2xlLayout ? 656 : null

  items.forEach(item => {
    if (item.kind === 'conclusion') {
      const c = item.c
      const cidx = item.cidx
      const ct = conclusionTypes.find(x => x.id === c.type)
      const title = c.title || ct?.label || c.type
      const color = ct?.color || '#888'
      elems.push(
        <div key={`conclusion-${cidx}`} style={{ textAlign: 'center', margin: '12px 16px' }}>
          <div style={{
            display: 'inline-block', maxWidth: regularBalloonMaxWidth || '92%', width: '100%', textAlign: 'left',
            background: '#161620', border: `1px solid ${color}44`,
            borderRadius: 12, padding: '14px 20px', fontSize: 13,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ color: color, fontWeight: 700, fontSize: 11, textTransform: c.title ? 'none' : 'uppercase', letterSpacing: c.title ? 0 : 1 }}>{title}</span>
              <span style={{ color: '#555', fontSize: 11 }}>· {c.model}</span>
              <button onClick={() => setConclusions(prev => prev.filter((_, j) => j !== cidx))}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>✕</button>
            </div>
            <div className="bubble" style={{ color: '#c9d1d9' }}
              dangerouslySetInnerHTML={{ __html: marked.parse(normalizeMathShorthands(c.content)) }} />
          </div>
        </div>
      )
      return
    }

    const { msg, idx: i } = item
    if (msg.role === 'topic') {
      elems.push(
        <div key={`topic-${i}`} style={{ textAlign: 'center' }}>
          <div style={{ ...styles.bubble('topic'), display: 'inline-block', fontSize: 13, color: '#aaa' }}>
            <span style={{ color: '#555', marginRight: 6 }}>{ui.topic}</span>
            <span dangerouslySetInnerHTML={{ __html: markedInline(normalizeMathShorthands(msg.content || '')) }} />
          </div>
        </div>
      )
      return
    }

    if (msg.role === 'interjection') {
      elems.push(
        <div key={`interjection-${i}`} style={{ textAlign: 'center' }}>
          <div style={{ ...styles.bubble('topic'), display: 'inline-block', fontSize: 13, color: '#aaa', borderColor: '#3a3a2e', background: '#1e1e16' }}>
            <span style={{ color: '#777', marginRight: 6 }}>{ui.variation}</span>
            <span dangerouslySetInnerHTML={{ __html: markedInline(normalizeMathShorthands(msg.content || '')) }} />
          </div>
        </div>
      )
      return
    }

    if (msg.role === 'user') {
      elems.push(
        <div key={`user-${i}`} style={styles.msgWrap('user', null)}>
          <div style={styles.roleTag('user', null)}>{ui.user}</div>
          <div style={{ width: '82%', alignSelf: 'flex-end', ...(regularBalloonMaxWidth ? { maxWidth: regularBalloonMaxWidth } : {}) }}>
            <div className="bubble" style={{ ...styles.bubble('user', null), width: '100%', boxSizing: 'border-box' }}
              dangerouslySetInnerHTML={{ __html: marked.parse(normalizeMathShorthands(msg.content || '')) }} />
          </div>
        </div>
      )
      return
    }

    if (msg.role === 'error') {
      elems.push(
        <div key={`err-${i}`} style={{ textAlign: 'center', margin: '8px 0' }}>
          <div style={{
            display: 'inline-block', background: '#3a1a1a', border: '1px solid #7a2a2a',
            borderRadius: 8, padding: '8px 16px', color: '#ff6b6b', fontSize: 13,
          }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              <span>{msg.content}</span>
              <button
                onClick={() => onResume?.()}
                disabled={typeof onResume !== 'function'}
                style={{
                  background: '#334155',
                  border: '1px solid #3e4a5a',
                  color: '#e0e0e0',
                  borderRadius: 6,
                  padding: '3px 10px',
                  fontSize: 12,
                  cursor: typeof onResume === 'function' ? 'pointer' : 'default',
                  opacity: typeof onResume === 'function' ? 1 : 0.5,
                  fontWeight: 600,
                }}
              >
                {ui.resume}
              </button>
            </div>
          </div>
        </div>
      )
      return
    }

    // ── presence events (join / leave) — skip turn badge ──────────────────
    if (msg.role === 'participant_left' || msg.role === 'participant_joined') {
      const snap = msg.participantSnapshot
      const isLeft = msg.role === 'participant_left'
      const displayName = snap?.name || snap?.tag || '?'
      elems.push(
        <div key={`presence-${i}`} style={{ textAlign: 'center', margin: '10px 0' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: isLeft ? '#1a1212' : '#121a12',
            border: `1px solid ${isLeft ? '#7a2a2a44' : '#2a7a2a44'}`,
            borderRadius: 20, padding: '5px 14px',
            fontSize: 11, color: isLeft ? '#aa5555' : '#55aa55', letterSpacing: 0.3,
          }}>
            <span style={{ opacity: 0.6 }}>{isLeft ? '←' : '→'}</span>
            <span style={{ fontWeight: 700, color: snap?.label }}>{displayName}</span>
            <span>{isLeft ? ui.left : ui.joined}</span>
          </div>
        </div>
      )
      return
    }

    if (msg.turn !== lastTurn) {
      lastTurn = msg.turn
      elems.push(
        <div key={`turn-${i}`} style={styles.turnBadge}>{ui.round(msg.turn)}</div>
      )
    }

    // Use participant snapshot at send time, with live fallback
    const actor = msg.participantSnapshot || participants.find(p => p.tag === msg.role)
    if (!actor) return
    const isModeratorMessage = !!actor.isModerator && actor.model !== userModel
    const isModerationIntervention = isModeratorMessage && looksLikeModerationIntervention(msg.content)
    const isStreamingMsg = streamingSeq != null ? msg.seq === streamingSeq : streamingRole === msg.role
    const moderatorBubbleStyle = isModerationIntervention
      ? {
          background: '#2a1010',
          border: '2px dashed #ef4444cc',
          boxShadow: 'inset 0 0 0 1px #ef444433',
          borderRadius: 12,
        }
      : null
    elems.push(
      <div key={`msg-${i}`} style={{ ...styles.msgWrap(msg.role, actor), ...(isModerationIntervention ? { alignItems: 'center' } : {}) }}>
        <div style={{ ...styles.roleTag(msg.role, actor), ...(isModerationIntervention ? { alignSelf: 'center', color: '#ef4444' } : {}), display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span>{actor.name || actor.tag} · {actor.model === userModel ? `👤 ${common.user}` : `${actor.model} · ${(() => { const m = moods.find(x => x.id === actor.mood); const intensity = moodIntensity[actor.moodIntensity ?? defaultMoodIntensity]; return m ? `${m.emoji} ${m.label} (${intensity.label})` : '' })()}`} <span style={{ fontWeight: 400, color: '#555' }}>(round {msg.turn})</span></span>
          {isStreamingMsg && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.75, animation: 'spin 1s linear infinite' }}>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
          )}
        </div>
        <div className="balloon-group" style={{
          ...styles.balloonWrap(actor),
          ...(isModerationIntervention ? { width: '92%', maxWidth: regularBalloonMaxWidth || 980, alignSelf: 'center' } : {}),
          ...(!isModerationIntervention && regularBalloonMaxWidth ? { maxWidth: regularBalloonMaxWidth } : {}),
          ...(!msg.content && streamingRole === msg.role
            ? (isModerationIntervention ? { width: 'auto', alignSelf: 'center' } : { width: 'auto', alignSelf: actor ? (actor.id % 2 === 0 ? 'flex-start' : 'flex-end') : 'flex-end' })
            : {}),
        }}>
          {msg.content || !isStreamingMsg
            ? <div className="bubble" style={{ ...styles.bubble(msg.role, actor), ...(moderatorBubbleStyle || {}) }}>
                {isModerationIntervention && (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center',
                    background: '#2a1010', border: '1px solid #ef444455',
                    borderRadius: 999, padding: '2px 8px',
                    fontSize: 10, color: '#ef4444', fontWeight: 700,
                    letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 6,
                  }}>
                    {ui.moderation}
                  </div>
                )}
                <div dangerouslySetInnerHTML={{ __html: marked.parse(normalizeMathShorthands(msg.content || '')) }} />
              </div>
            : <div className="bubble" style={{ ...styles.bubble(msg.role, actor), ...(moderatorBubbleStyle || {}), width: 'auto' }}>{Dots({})}</div>
          }
          {msg.content && (
            <div style={styles.floatBtns(actor)}>
              <button
                className="float-btn"
                style={styles.floatBtn(copiedIdx === i)}
                title={ui.copyResponse}
                onClick={() => {
                  navigator.clipboard.writeText(msg.content).then(() => {
                    setCopiedIdx(i)
                    setTimeout(() => setCopiedIdx(null), 1500)
                  })
                }}
              >{copiedIdx === i ? '✓' : <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="7" height="7" rx="1"/><path d="M3 8H2a1 1 0 01-1-1V2a1 1 0 011-1h5a1 1 0 011 1v1"/></svg>}</button>
              {msg.payload && (
                <button
                  className="float-btn"
                  style={styles.floatBtn(false)}
                  title={ui.inspectPayload}
                  onClick={() => setPayloadModal(
                    msg.debugPayloads?.length > 1
                      ? { rounds: msg.debugPayloads }
                      : msg.payload
                  )}
                >⚙</button>
              )}
            </div>
          )}
        </div>
      </div>
    )
  })

  return elems
}
