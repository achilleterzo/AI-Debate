import { styles } from './Style'
import { buildOrderedItems } from '../utils/Sorting'
import {
  alignmentFor,
  buildMessageGroup,
  describeToolInvocation,
  isLastContinuationBalloon,
  isRenderableParticipantMessage,
  resolveActor,
  resolveDiceOwner,
  tailClassFor,
} from '../utils/ChatGrouping'
import { normalizeMathShorthands, renderMessageMarkdown } from '../utils/MessageMarkdown'
import { useUiStrings } from '../i18n/UiStringsContext'
import { TOOL_ICONS } from '../tools'

function toolInvocationPill(invocation, key, alignment) {
  const details = describeToolInvocation(invocation)
  return (
    <div key={key} className="tool-pill" style={{ alignSelf: alignment }}>
      <span className="tool-pill-icon">{TOOL_ICONS[invocation?.name] || '🛠️'}</span>
      <span className="tool-pill-name">{invocation?.name}</span>
      {details && <span className="tool-pill-details"> · {details}</span>}
    </div>
  )
}

function diceNote(result, owner, key, extraStyle, fallbackActor) {
  const ownerName = owner?.name || owner?.tag || 'Shared dice result'
  const border = owner?.border || fallbackActor?.border || '#514a78'
  return (
    <div
      key={key}
      className="dice-note"
      style={{
        ...extraStyle,
        '--dice-bg': owner?.bg || fallbackActor?.bg || '#17152a',
        '--dice-border': border,
        '--dice-glow': `${border}44`,
        '--dice-label': owner?.label || fallbackActor?.label || '#c9bfff',
      }}
    >
      <span className="dice-note-owner">🎲 {ownerName}</span>
      <span>{result.content}</span>
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
  DotsComponent: Dots,
  onResume,
  isWideLayout,
}) {
  const UI_STRINGS = useUiStrings()
  const ui = UI_STRINGS.chat
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
              dangerouslySetInnerHTML={{ __html: renderMessageMarkdown(c.content) }} />
          </div>
        </div>
      )
      return
    }

    const { msg, idx: i } = item
    if (msg.role === 'topic') {
      elems.push(
        <div key={`topic-${i}`} style={{ textAlign: 'center' }}>
          <div className="bubble balloon" style={{ ...styles.bubble('topic'), display: 'inline-block', fontSize: 13, color: '#aaa' }}>
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
          <div className="bubble balloon" style={{ ...styles.bubble('topic'), display: 'inline-block', fontSize: 13, color: '#aaa', '--balloon-border': '#3a3a2e', '--balloon-bg': '#1e1e16' }}>
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
          <div className="msg-label" style={styles.roleTag('user', null)}>{ui.user}</div>
          <div style={{ width: '82%', alignSelf: 'flex-end', ...(regularBalloonMaxWidth ? { maxWidth: regularBalloonMaxWidth } : {}) }}>
            {/* Right-aligned like the balloon radius assumes, so the tail goes
                on the square corner just like every other balloon. */}
            <div className="bubble balloon balloon-tail-right" style={styles.bubble('user', null)}
              dangerouslySetInnerHTML={{ __html: renderMessageMarkdown(msg.content) }} />
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
        ? resolveActor(previousMessage, participants)
        : null
      const diceOwner = resolveDiceOwner(msg, participants)
      if (previousActor && diceOwner && previousActor.id === diceOwner.id) return
      const diceAlign = diceOwner ? alignmentFor(diceOwner) : 'center'
      elems.push(
        <div key={`dice-${i}`} style={{ display: 'flex', justifyContent: diceAlign, width: '100%', margin: '4px 0 10px' }}>
          {diceNote(msg, diceOwner, `dice-note-${i}`, { maxWidth: '92%' }, null)}
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
          <div className={`presence-chip ${isLeft ? 'presence-chip-left' : 'presence-chip-joined'}`} style={{ '--label-color': snap?.label }}>
            <span className="presence-chip-arrow">{isLeft ? '←' : '→'}</span>
            <span className="presence-chip-name">{displayName}</span>
            <span>{isLeft ? ui.left : ui.joined}</span>
          </div>
        </div>
      )
      return
    }

    // Grouping — which balloons, tools and dice belong to this turn, and in
    // which order — is shared with the HTML export so the two never diverge.
    // Moderation styling is driven only by the explicit message tag assigned
    // by the debate engine, never by words found in the generated content.
    const group = buildMessageGroup({
      items,
      itemIndex,
      participants,
      isLocalUser: candidate => !!candidate.localUser || candidate.model === userModel,
    })
    if (!group) return
    const {
      actor,
      isModerationIntervention,
      continuationItems,
      continuationText,
      primaryContent,
      leadingToolEvents,
      trailingToolEvents,
      leadingDiceResults,
      primaryIsLastBalloon,
    } = group

    if (msg.turn !== lastTurn) {
      lastTurn = msg.turn
      elems.push(
        <div key={`turn-${i}`} className="turn-badge">{ui.round(msg.turn)}</div>
      )
    }
    const groupedPayloadMessage = [msg, ...continuationItems]
      .find(candidate => candidate.payload || candidate.debugPayloads?.length > 0)
    const isStreamingMsg = streamingSeq != null ? msg.seq === streamingSeq : streamingRole === msg.role
    const thinkingText = String(msg.thinking || '').trim()
    const contentAlignment = isModerationIntervention ? 'flex-start' : alignmentFor(actor)
    // The tail hangs off the square corner the balloon radius leaves open,
    // which is always the one facing away from the centre of the timeline.
    // Moderation is a centred banner, not a spoken line, so it gets none.
    const tailClass = isModerationIntervention ? '' : ` ${tailClassFor(actor)}`
    elems.push(
      <div key={`msg-${i}`} style={{ ...styles.msgWrap(msg.role, actor), ...(isModerationIntervention ? { alignItems: 'center' } : {}) }}>
        <div className="msg-label" style={{ ...styles.roleTag(msg.role, actor), ...(isModerationIntervention ? { alignSelf: 'center', width: '92%', maxWidth: regularBalloonMaxWidth || 980, justifyContent: 'flex-start', '--label-color': '#ef4444' } : {}) }}>
          <span>{actor.name || actor.tag} <span className="msg-label-round">({ui.round(msg.turn)})</span></span>
          {isStreamingMsg && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.75, animation: 'spin 1s linear infinite' }}>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
          )}
        </div>
        <div className="balloon-group" style={{
          ...styles.balloonWrap(actor),
          display: 'flex', flexDirection: 'column', alignItems: contentAlignment, gap: 4,
          ...(isModerationIntervention ? { width: '92%', maxWidth: regularBalloonMaxWidth || 980, alignSelf: 'center' } : {}),
          ...(!isModerationIntervention && regularBalloonMaxWidth ? { maxWidth: regularBalloonMaxWidth } : {}),
          ...(!msg.content && streamingRole === msg.role
            ? (isModerationIntervention ? { width: 'auto', alignSelf: 'center' } : { width: 'auto', alignSelf: alignmentFor(actor) })
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
          {leadingDiceResults.map((result, resultIndex) => diceNote(
            result,
            resolveDiceOwner(result, participants),
            `leading-dice-${i}-${resultIndex}`,
            { alignSelf: contentAlignment },
            actor,
          ))}
          {primaryContent
            ? <div
                className={`bubble balloon${isModerationIntervention ? ' balloon-moderation' : ''}${primaryIsLastBalloon ? tailClass : ''}`}
                style={{ ...styles.bubble(msg.role, actor), '--balloon-radius': primaryIsLastBalloon ? actor.radiusOwn : '12px' }}
              >
                {isModerationIntervention && <div className="moderation-badge">{ui.moderation}</div>}
                <div dangerouslySetInnerHTML={{ __html: renderMessageMarkdown(primaryContent) }} />
              </div>
            : isStreamingMsg ? <div className={`bubble balloon${isModerationIntervention ? ' balloon-moderation' : ''}`} style={{
                ...styles.bubble(msg.role, actor),
                width: 'auto',
                alignSelf: alignmentFor(actor),
              }}>{Dots({})}</div>
            : null
          }
          {primaryContent && (
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
              return diceNote(
                continuation,
                resolveDiceOwner(continuation, participants),
                `continuation-dice-${continuationIndex}`,
                { alignSelf: contentAlignment },
                actor,
              )
            }
            // Already folded into the moderation balloon above.
            if (isModerationIntervention) return null
            const isLastBalloon = isLastContinuationBalloon(continuationItems, continuationIndex)
            return (
              <div
                key={`continuation-message-${continuationIndex}`}
                className={`bubble balloon${isLastBalloon ? tailClass : ''}`}
                style={{ ...styles.bubble(continuation.role, actor), '--balloon-radius': isLastBalloon ? actor.radiusOwn : '12px' }}
              >
                <div dangerouslySetInnerHTML={{ __html: renderMessageMarkdown(continuation.content) }} />
              </div>
            )
          })}
        </div>
      </div>
    )
  })

  return elems
}
