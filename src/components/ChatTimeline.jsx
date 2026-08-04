import { marked } from 'marked'
import { styles } from './Style'
import { buildOrderedItems } from '../utils/Sorting'
import { useUiStrings } from '../i18n/UiStringsContext'
import { TOOL_ICONS } from '../tools'

function normalizeMathShorthands(text) {
  let out = String(text || '')
  out = out.replace(/\$\s*\\rightarrow\s*\$/g, '→')
  out = out.replace(/\$\s*\\leftarrow\s*\$/g, '←')
  out = out.replace(/\$\s*\\Rightarrow\s*\$/g, '⇒')
  out = out.replace(/\$\s*\\Leftarrow\s*\$/g, '⇐')
  out = out.replace(/\$\s*\\leftrightarrow\s*\$/g, '↔')
  return out
}

function describeToolInvocation(invocation) {
  const args = invocation?.arguments || {}
  if (invocation?.name === 'web_search') return args.query || ''
  if (invocation?.name === 'get_recent_messages') {
    return [args.searchTerm, Array.isArray(args.participantTags) && args.participantTags.length ? `@${args.participantTags.join(', @')}` : null]
      .filter(Boolean).join(' · ')
  }
  if (invocation?.name === 'request_moderator_intervention') return args.reason || args.focus || ''
  return Object.values(args).filter(value => typeof value === 'string').join(' · ')
}

function resolveDiceOwner(msg, participants) {
  return participants.find(participant => (
    (msg.diceOwner?.id != null && participant.id === msg.diceOwner.id)
    || (msg.diceOwner?.tag && participant.tag === msg.diceOwner.tag)
  )) || msg.participantSnapshot || msg.diceOwner || null
}

function isRenderableParticipantMessage(message) {
  return message && !['participant_joined', 'participant_left', 'dice', 'topic', 'interjection', 'error'].includes(message.role)
}

function toolInvocationPill(invocation, key, alignment) {
  return (
    <div
      key={key}
      style={{
        alignSelf: alignment, maxWidth: '100%', boxSizing: 'border-box', padding: '4px 8px',
        border: '1px solid #514a78', borderRadius: 8,
        color: '#aaa', fontSize: 10, lineHeight: 1.35,
        background: '#171624',
        boxShadow: '0 0 8px rgba(139, 92, 246, 0.22), inset 0 0 7px rgba(139, 92, 246, 0.08)',
      }}
    >
      <span style={{ marginRight: 5 }}>{TOOL_ICONS[invocation?.name] || '🛠️'}</span>
      <span style={{ color: '#aaa' }}>{invocation?.name}</span>
      {describeToolInvocation(invocation) && <span style={{ color: '#666' }}> · {describeToolInvocation(invocation)}</span>}
    </div>
  )
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
  isWideLayout,
}) {
  const UI_STRINGS = useUiStrings()
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
  const regularBalloonMaxWidth = isWideLayout ? 656 : null

  items.forEach((item, itemIndex) => {
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
            <span className="selectable" dangerouslySetInnerHTML={{ __html: markedInline(normalizeMathShorthands(msg.content || '')) }} />
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
            <span className="selectable" dangerouslySetInnerHTML={{ __html: markedInline(normalizeMathShorthands(msg.content || '')) }} />
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
      const nonFatal = !!msg.nonFatal
      elems.push(
        <div key={`err-${i}`} style={{ textAlign: 'center', margin: '8px 0' }}>
          <div style={{
            display: 'inline-block',
            background: nonFatal ? '#2a2410' : '#3a1a1a',
            border: nonFatal ? '1px solid #7a6a2a' : '1px solid #7a2a2a',
            borderRadius: 8, padding: nonFatal ? '6px 14px' : '8px 16px',
            color: nonFatal ? '#e0c060' : '#ff6b6b', fontSize: nonFatal ? 12 : 13,
          }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              <span>{msg.content}</span>
              {!nonFatal && (
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
              )}
            </div>
          </div>
        </div>
      )
      return
    }

    if (msg.role === 'dice') {
      const previousMessage = items[itemIndex - 1]?.msg
      const previousActor = isRenderableParticipantMessage(previousMessage)
        ? (previousMessage.participantSnapshot || participants.find(participant => participant.tag === previousMessage.role))
        : null
      const diceOwner = resolveDiceOwner(msg, participants)
      if (previousActor && diceOwner && previousActor.id === diceOwner.id) return
      const diceOwnerName = diceOwner?.name || diceOwner?.tag || msg.diceOwner?.name || msg.diceOwner?.tag || 'Shared dice result'
      const diceAlign = diceOwner ? (diceOwner.id % 2 === 0 ? 'flex-start' : 'flex-end') : 'center'
      elems.push(
        <div key={`dice-${i}`} style={{ display: 'flex', justifyContent: diceAlign, width: '100%', margin: '4px 0 10px' }}>
          <div style={{ display: 'inline-block', maxWidth: '92%', background: diceOwner?.bg || '#17152a', border: `2px dashed ${diceOwner?.border || '#514a78'}`, borderRadius: 12, padding: '7px 14px', color: '#e0e0e0', fontSize: 12, boxShadow: `inset 0 0 0 1px ${diceOwner?.border || '#514a78'}44` }}>
            <span style={{ fontWeight: 700, marginRight: 7, color: diceOwner?.label || '#c9bfff' }}>🎲 {diceOwnerName}</span>
            <span>{msg.content}</span>
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

    // Use participant snapshot at send time, with live fallback
    const actor = msg.participantSnapshot || participants.find(p => p.tag === msg.role)
    if (!actor) return
    const previousMessage = items[itemIndex - 1]?.msg
    const previousActor = isRenderableParticipantMessage(previousMessage)
      ? (previousMessage.participantSnapshot || participants.find(participant => participant.tag === previousMessage.role))
      : null
    const previousDiceOwner = previousMessage?.role === 'dice' ? resolveDiceOwner(previousMessage, participants) : null
    const isLocalUser = !!actor.localUser || actor.model === userModel
    const isModeratorMessage = !!actor.isModerator && !isLocalUser
    const isModerationIntervention = isModeratorMessage && msg.messageType === 'moderation'
    const isContinuation = (
      !isModerationIntervention
      && (
        (previousActor?.id === actor.id && previousMessage.turn === msg.turn && previousMessage.messageType !== 'moderation')
        || (previousDiceOwner?.id === actor.id)
      )
    )
    if (isContinuation) return
    if (msg.turn !== lastTurn && !isContinuation) {
      lastTurn = msg.turn
      elems.push(
        <div key={`turn-${i}`} style={styles.turnBadge}>{ui.round(msg.turn)}</div>
      )
    }
    // Moderation styling is driven only by the explicit message tag assigned
    // by the debate engine, never by words found in the generated content.
    const continuationItems = []
    for (let continuationIndex = itemIndex + 1; continuationIndex < items.length; continuationIndex += 1) {
      const candidate = items[continuationIndex]?.msg
      if (!candidate) break
      if (candidate.messageType === 'moderation') break
      if (candidate.role === 'dice') {
        if (resolveDiceOwner(candidate, participants)?.id !== actor.id) break
        continuationItems.push(candidate)
        continue
      }
      const candidateActor = candidate.participantSnapshot || participants.find(participant => participant.tag === candidate.role)
      if (candidateActor?.id !== actor.id || candidate.turn !== msg.turn) break
      continuationItems.push(candidate)
    }
    const continuationText = [msg.content, ...continuationItems.filter(candidate => candidate.role !== 'dice').map(candidate => candidate.content)]
      .filter(Boolean)
      .join('\n\n')
    const toolEvents = msg.toolEvents?.length
      ? msg.toolEvents
      : (msg.toolInvocations || []).map(invocation => ({ type: 'invocation', invocation, beforeContent: false }))
    const leadingToolEvents = toolEvents.filter(event => event.type === 'invocation' && event.beforeContent)
    const trailingToolEvents = toolEvents.filter(event => !(event.type === 'invocation' && event.beforeContent))
    const leadingDiceResults = continuationItems.filter(candidate => candidate.role === 'dice' && candidate.beforeContent)
    const primaryIsLastBalloon = !continuationItems.some(candidate => candidate.role !== 'dice')
    const groupedPayloadMessage = [msg, ...continuationItems]
      .find(candidate => candidate.payload || candidate.debugPayloads?.length > 0)
    const isStreamingMsg = streamingSeq != null ? msg.seq === streamingSeq : streamingRole === msg.role
    const thinkingText = String(msg.thinking || '').trim()
    const contentAlignment = isModerationIntervention
      ? 'flex-start'
      : (actor ? (actor.id % 2 === 0 ? 'flex-start' : 'flex-end') : 'flex-end')
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
        {!isContinuation && <div style={{ ...styles.roleTag(msg.role, actor), ...(isModerationIntervention ? { alignSelf: 'center', width: '92%', maxWidth: regularBalloonMaxWidth || 980, justifyContent: 'flex-start', color: '#ef4444' } : {}), display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span>{actor.name || actor.tag} · {isLocalUser ? `👤 ${common.user}` : `${actor.model} · ${(() => { const m = moods.find(x => x.id === actor.mood); const intensity = moodIntensity[actor.moodIntensity ?? defaultMoodIntensity]; return m ? `${m.emoji} ${m.label} (${intensity.label})` : '' })()}`} <span style={{ fontWeight: 400, color: '#555' }}>({ui.round(msg.turn)})</span></span>
          {isStreamingMsg && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.75, animation: 'spin 1s linear infinite' }}>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
          )}
        </div>}
        <div className="balloon-group" style={{
          ...styles.balloonWrap(actor),
          display: 'flex', flexDirection: 'column', alignItems: contentAlignment, gap: 4,
          ...(isModerationIntervention ? { width: '92%', maxWidth: regularBalloonMaxWidth || 980, alignSelf: 'center' } : {}),
          ...(!isModerationIntervention && regularBalloonMaxWidth ? { maxWidth: regularBalloonMaxWidth } : {}),
          ...(!msg.content && streamingRole === msg.role
            ? (isModerationIntervention ? { width: 'auto', alignSelf: 'center' } : { width: 'auto', alignSelf: actor ? (actor.id % 2 === 0 ? 'flex-start' : 'flex-end') : 'flex-end' })
            : {}),
          }}>
          {thinkingText && (
            <div style={{ alignSelf: contentAlignment }}>
              <button
                type="button"
                title={ui.reasoning}
                onClick={() => setPayloadModal({ title: ui.reasoning, reasoningSeq: msg.seq })}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '3px 8px', borderRadius: 999,
                  border: '1px solid #514a78', background: '#171624',
                  color: '#aaa', fontSize: 10, cursor: 'pointer',
                }}
              >
                <span>💭</span>
                <span style={{ animation: isStreamingMsg ? 'reasoningGlow 1.4s ease-in-out infinite' : undefined }}>
                  {isStreamingMsg ? `${ui.reasoning}...` : ui.reasoning}
                </span>
              </button>
            </div>
          )}
          {leadingToolEvents.map((event, eventIndex) => toolInvocationPill(event.invocation, `tool-before-${i}-${eventIndex}`, contentAlignment))}
          {leadingDiceResults.map((result, resultIndex) => {
            const diceOwner = resolveDiceOwner(result, participants)
            const diceOwnerName = diceOwner?.name || diceOwner?.tag || 'Shared dice result'
            const diceBorder = diceOwner?.border || actor.border || '#514a78'
            return (
              <div key={`leading-dice-${i}-${resultIndex}`} style={{ alignSelf: contentAlignment, maxWidth: '100%', padding: '7px 14px', background: diceOwner?.bg || actor.bg || '#17152a', border: `2px dashed ${diceBorder}`, borderRadius: 12, color: '#e0e0e0', fontSize: 12, boxShadow: `inset 0 0 0 1px ${diceBorder}44` }}>
                <span style={{ fontWeight: 700, marginRight: 7, color: diceOwner?.label || actor.label || '#c9bfff' }}>🎲 {diceOwnerName}</span>
                <span>{result.content}</span>
              </div>
            )
          })}
          {msg.content
            ? <div className="bubble" style={{ ...styles.bubble(msg.role, actor), borderRadius: primaryIsLastBalloon ? actor.radiusOwn : 12, ...(moderatorBubbleStyle || {}) }}>
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
            : isStreamingMsg ? <div className="bubble" style={{
                ...styles.bubble(msg.role, actor),
                ...(moderatorBubbleStyle || {}),
                width: 'auto',
                alignSelf: actor ? (actor.id % 2 === 0 ? 'flex-start' : 'flex-end') : 'flex-end',
              }}>{Dots({})}</div>
            : null
          }
          {msg.content && (
            <div style={styles.floatBtns(actor)}>
              <button
                className="float-btn"
                style={styles.floatBtn(copiedIdx === i)}
                title={ui.copyResponse}
                onClick={() => {
                    navigator.clipboard.writeText(continuationText).then(() => {
                    setCopiedIdx(i)
                    setTimeout(() => setCopiedIdx(null), 1500)
                  })
                }}
              >{copiedIdx === i ? '✓' : <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="7" height="7" rx="1"/><path d="M3 8H2a1 1 0 01-1-1V2a1 1 0 011-1h5a1 1 0 011 1v1"/></svg>}</button>
              {groupedPayloadMessage && (
                <button
                  className="float-btn"
                  style={styles.floatBtn(false)}
                  title={ui.inspectPayload}
                  onClick={() => setPayloadModal(
                    groupedPayloadMessage.debugPayloads?.length > 1
                      ? { rounds: groupedPayloadMessage.debugPayloads }
                      : groupedPayloadMessage.payload
                  )}
                >⚙</button>
              )}
            </div>
          )}
          {trailingToolEvents.map((event, eventIndex) => toolInvocationPill(event.invocation, `tool-after-${i}-${eventIndex}`, contentAlignment))}
          {continuationItems.map((continuation, continuationIndex) => {
            if (continuation.role === 'dice' && continuation.beforeContent) return null
            if (continuation.role === 'dice') {
              const diceOwner = resolveDiceOwner(continuation, participants)
              const diceOwnerName = diceOwner?.name || diceOwner?.tag || 'Shared dice result'
              const diceBorder = diceOwner?.border || actor.border || '#514a78'
              return (
                <div key={`continuation-dice-${continuationIndex}`} style={{ alignSelf: contentAlignment, maxWidth: '100%', padding: '7px 14px', background: diceOwner?.bg || actor.bg || '#17152a', border: `2px dashed ${diceBorder}`, borderRadius: 12, color: '#e0e0e0', fontSize: 12, boxShadow: `inset 0 0 0 1px ${diceBorder}44` }}>
                  <span style={{ fontWeight: 700, marginRight: 7, color: diceOwner?.label || actor.label || '#c9bfff' }}>🎲 {diceOwnerName}</span>
                  <span>{continuation.content}</span>
                </div>
              )
            }
            return (
              <div key={`continuation-message-${continuationIndex}`} className="bubble" style={{ ...styles.bubble(continuation.role, actor), borderRadius: continuationItems.slice(continuationIndex + 1).some(candidate => candidate.role !== 'dice') ? 12 : actor.radiusOwn }}>
                <div dangerouslySetInnerHTML={{ __html: marked.parse(normalizeMathShorthands(continuation.content || '')) }} />
              </div>
            )
          })}
        </div>
      </div>
    )
  })

  return elems
}
