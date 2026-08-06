import { topicToSlug } from '../utils/Slug'
import { buildOrderedItems } from '../utils/Sorting'
import { DEFAULT_DEBATE_MODE, DEBATE_MODES, normalizeDebateMode } from '../prompts/Modes'
import { UI_LANGUAGE_OPTIONS, formatLanguageLabel } from '../i18n/UiStrings'
import { APP_VERSION } from '../settings/Settings'
// The export is meant to look like the chat, so it reuses the chat's own
// stylesheet and the chat's own idea of how a turn is put together.
import { CHAT_CSS } from '../styles/ChatCss'
import { renderMessageMarkdown } from '../utils/MessageMarkdown'
import {
  alignmentFor,
  buildMessageGroup,
  describeToolInvocation,
  isLastContinuationBalloon,
  isRenderableParticipantMessage,
  resolveDiceOwner,
  tailClassFor,
} from '../utils/ChatGrouping'

function debateModeInfo(value) {
  const id = normalizeDebateMode(value ?? DEFAULT_DEBATE_MODE)
  return DEBATE_MODES.find(mode => mode.id === id) ?? DEBATE_MODES[0]
}

/**
 * The debate output language, for the export header.
 *
 * A language from the list carries its ISO code; a custom one is free text
 * stored as-is and has no code to show.
 */
function debateLanguageLabel(uiLang) {
  const entry = UI_LANGUAGE_OPTIONS.find(language => language.code === uiLang)
  return entry ? formatLanguageLabel(entry) : String(uiLang ?? '').trim()
}

export class Data {
  static triggerDownload(content, filename, mime) {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
  }

  static buildExportSlug(topic, fallbackPrefix = 'ai-debate') {
    const topicSlug = topicToSlug(topic)
    const dateStr = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-')
    return topicSlug ? `ai-debate-${topicSlug}-${dateStr}` : `${fallbackPrefix}-${dateStr}`
  }

  static resolveActor(msg, participants) {
    return msg.participantSnapshot || participants.find(p => p.tag === msg.role) || null
  }

  /** The export document, as a string — kept separate so it can be inspected. */
  static buildHTML({
    messages,
    participants,
    baseUrl,
    conclusions = [],
    debateMode = DEFAULT_DEBATE_MODE,
    uiLang = '',
    constants,
  }) {
    const {
      MOODS,
      MOOD_INTENSITY,
      DEFAULT_MOOD_INTENSITY,
      AGE_GROUPS,
      DEFAULT_AGE_GROUP,
      EDUCATION_LEVELS,
      CHARACTER_TYPES = [],
      RESPONSE_LENGTHS = [],
    } = constants

    const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const md = s => renderMessageMarkdown(s)
    const toolIcons = { web_search: '🔍', get_recent_messages: '🕘', request_moderator_intervention: '🙋', apply_moderation: '🛑', roll_dice: '🎲', memory: '🧠' }
    const now = new Date().toLocaleString('it-IT')
    const mode = debateModeInfo(debateMode)
    const language = debateLanguageLabel(uiLang)

    const CONCLUSION_COLORS = {
      summary: '#4a9eff',
      verdict: '#f59e0b',
      contradictions: '#ef4444',
      blindspot: '#a78bfa',
      next_steps: '#10b981',
      custom: '#22d3ee',
      considerations: '#a78bfa',
    }

    const partRows = participants.map(p => {
      const name = p.name ? ` (${esc(p.name)})` : ''
      const moderatorStr = p.isModerator ? ' · Moderator' : ''
      const char = CHARACTER_TYPES.find(c => c.value === (p.characterType ?? null))
      const charStr = ` · ${esc(char?.label ?? 'Person')}`
      const resp = RESPONSE_LENGTHS.find(r => r.value === (p.responseLength ?? null))
      const respStr = ` · Verbosity: ${esc(resp?.label ?? 'Free')}`
      const moodObj = MOODS.find(m => m.id === p.mood)
      const moodStr = moodObj?.instruction ? ` · ${moodObj.emoji} ${moodObj.label}` : ''
      const intensity = MOOD_INTENSITY[p.moodIntensity ?? DEFAULT_MOOD_INTENSITY]
      const intensityStr = moodObj?.instruction && intensity ? ` [${intensity.label}]` : ''
      const age = AGE_GROUPS[p.ageGroup ?? DEFAULT_AGE_GROUP]
      const ageStr = ` · ${age?.label ?? '-'}`
      const edu = EDUCATION_LEVELS.find(e => e.value === (p.educationLevel ?? null))
      const eduStr = edu?.instruction ? ` · ${edu.label}` : ''
      const epStr = p.endpointOverride?.trim() ? ' · EP' : ''
      return `<div class="part-row"><span style="color:${p.label};font-weight:700">${p.tag}</span>${name}${charStr}${respStr}${moodStr}${intensityStr}${eduStr}${ageStr}${epStr}${moderatorStr}</div>`
    }).join('')

    const items = buildOrderedItems(messages.filter(msg => msg.role !== 'error'), conclusions)
    const actorsSeen = new Map()
    for (const item of items) {
      if (item.kind !== 'conclusion' && item.msg) {
        const actor = Data.resolveActor(item.msg, participants)
        if (actor && !actorsSeen.has(actor.tag)) actorsSeen.set(actor.tag, actor)
      }
    }
    for (const participant of participants) {
      if (!actorsSeen.has(participant.tag)) actorsSeen.set(participant.tag, participant)
    }

    // ── the same building blocks the chat renders, as HTML strings ─────────
    const toolPill = invocation => {
      const details = describeToolInvocation(invocation)
      return `<div class="tool-pill"><span class="tool-pill-icon">${toolIcons[invocation?.name] || '🛠️'}</span><span class="tool-pill-name">${esc(invocation?.name ?? '')}</span>${details ? `<span class="tool-pill-details"> · ${esc(details)}</span>` : ''}</div>`
    }
    const diceNote = (result, owner, fallbackActor) => {
      const ownerName = owner?.name || owner?.tag || 'Shared dice result'
      const border = owner?.border || fallbackActor?.border || '#514a78'
      const vars = `--dice-bg:${owner?.bg || fallbackActor?.bg || '#17152a'};--dice-border:${border};--dice-glow:${border}44;--dice-label:${owner?.label || fallbackActor?.label || '#c9bfff'};`
      return `<div class="dice-note" style="${vars}"><span class="dice-note-owner">🎲 ${esc(ownerName)}</span><span>${esc(result.content)}</span></div>`
    }
    const balloon = ({ content, actor, radius, tail, moderation }) => {
      const vars = `--balloon-bg:${actor.bg};--balloon-border:${actor.border};--balloon-radius:${radius};`
      const badge = moderation ? '<div class="moderation-badge">Moderation</div>' : ''
      return `<div class="bubble balloon${moderation ? ' balloon-moderation' : ''}${tail ? ` ${tail}` : ''}" style="${vars}">${badge}${md(content)}</div>`
    }

    let lastTurn = null
    let body = ''

    for (const [itemIndex, item] of items.entries()) {
      if (item.kind === 'conclusion') {
        const conclusion = item.c
        const color = CONCLUSION_COLORS[conclusion.type] || '#888'
        const typeLabel = conclusion.title || conclusion.type.charAt(0).toUpperCase() + conclusion.type.slice(1)
        body += `<div class="conclusion" style="border-color:${color}44;"><div class="conc-label" style="color:${color};${conclusion.title ? 'text-transform:none;letter-spacing:0;' : ''}">${esc(typeLabel)}</div>${md(conclusion.content)}</div>`
        continue
      }

      const msg = item.msg

      if (msg.role === 'topic') {
        body += `<div class="topic"><h1>Topic</h1>${md(msg.content)}</div>`
        continue
      }

      if (msg.role === 'user') {
        body += `<div class="msg msg-right"><div class="msg-label" style="--label-color:#f97316">User</div>${balloon({
          content: msg.content,
          actor: { bg: '#2a1f1f', border: '#f97316aa' },
          radius: '12px 12px 2px 12px',
          tail: 'balloon-tail-right',
        })}</div>`
        continue
      }

      if (msg.role === 'interjection') {
        body += `<div class="topic-variation"><h2>↳ Variation</h2>${md(msg.content)}</div>`
        continue
      }

      if (msg.role === 'dice') {
        // Rolls owned by the participant who just spoke are folded into that
        // participant's group below, exactly as the chat does.
        const previousMessage = items[itemIndex - 1]?.msg
        const previousActor = isRenderableParticipantMessage(previousMessage) ? Data.resolveActor(previousMessage, participants) : null
        const diceOwner = resolveDiceOwner(msg, participants)
        if (previousActor && diceOwner && previousActor.id === diceOwner.id) continue
        const align = diceOwner ? alignmentFor(diceOwner) : 'center'
        body += `<div class="dice-row" style="justify-content:${align}">${diceNote(msg, diceOwner, null)}</div>`
        continue
      }

      if (msg.role === 'participant_left' || msg.role === 'participant_joined') {
        const snap = msg.participantSnapshot
        const isLeft = msg.role === 'participant_left'
        const displayName = esc(snap?.name || snap?.tag || '?')
        body += `<div class="presence-row"><div class="presence-chip ${isLeft ? 'presence-chip-left' : 'presence-chip-joined'}" style="--label-color:${snap?.label || '#888'}"><span class="presence-chip-arrow">${isLeft ? '←' : '→'}</span><span class="presence-chip-name">${displayName}</span><span>${isLeft ? 'has left the conversation' : 'has joined the conversation'}</span></div></div>`
        continue
      }

      // One group per turn, assembled by the same helper the chat uses, so the
      // tools, dice and follow-up balloons keep the order seen on screen.
      const group = buildMessageGroup({ items, itemIndex, participants })
      if (!group) continue
      const {
        actor,
        isModerationIntervention,
        continuationItems,
        primaryContent,
        leadingToolEvents,
        trailingToolEvents,
        leadingDiceResults,
        primaryIsLastBalloon,
      } = group

      if (msg.turn !== lastTurn && msg.turn) {
        lastTurn = msg.turn
        body += `<div class="turn-badge">— round ${msg.turn} —</div>`
      }

      const contentAlignment = isModerationIntervention ? 'flex-start' : alignmentFor(actor)
      const alignClass = isModerationIntervention ? 'msg-center' : (contentAlignment === 'flex-start' ? 'msg-left' : 'msg-right')
      const tailClass = isModerationIntervention ? '' : tailClassFor(actor)
      const radiusOwn = actor.radiusOwn || '12px'

      const parts = []
      parts.push(...leadingToolEvents.map(event => toolPill(event.invocation)))
      parts.push(...leadingDiceResults.map(result => diceNote(result, resolveDiceOwner(result, participants), actor)))
      if (primaryContent) {
        parts.push(balloon({
          content: primaryContent,
          actor,
          radius: isModerationIntervention || !primaryIsLastBalloon ? '12px' : radiusOwn,
          tail: primaryIsLastBalloon ? tailClass : '',
          moderation: isModerationIntervention,
        }))
      }
      parts.push(...trailingToolEvents.map(event => toolPill(event.invocation)))
      continuationItems.forEach((continuation, continuationIndex) => {
        if (continuation.role === 'dice') {
          if (continuation.beforeContent) return
          parts.push(diceNote(continuation, resolveDiceOwner(continuation, participants), actor))
          return
        }
        // Already folded into the moderation balloon above.
        if (isModerationIntervention) return
        const isLastBalloon = isLastContinuationBalloon(continuationItems, continuationIndex)
        parts.push(balloon({
          content: continuation.content,
          actor,
          radius: isLastBalloon ? radiusOwn : '12px',
          tail: isLastBalloon ? tailClass : '',
        }))
      })

      const name = esc(actor.name || actor.tag)
      const labelColor = isModerationIntervention ? '#ef4444' : actor.label
      body += `<div class="msg ${alignClass}"><div class="msg-label" style="--label-color:${labelColor}">${name}${msg.turn ? ` <span class="msg-label-round">(round ${msg.turn})</span>` : ''}</div><div class="balloon-group" style="--group-align:${contentAlignment}">${parts.join('')}</div></div>`
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>AI Debate — Export ${now}</title>
  <style>
    /* Balloons, markdown, tool pills and dice come from the app's own chat
       stylesheet (src/styles/ChatCss.js), inlined here verbatim. Only the page
       around them — header, topic, conclusions, layout — is defined below. */
${CHAT_CSS}
    *{box-sizing:border-box;}
    body{margin:0 auto;padding:28px 32px;background:#0f0f0f;color:#e0e0e0;font-family:system-ui,'Segoe UI',Roboto,sans-serif;font-size:15px;max-width:900px;}
    h1{font-size:16px;font-weight:700;color:#a78bfa;margin:0 0 6px;}
    .meta{font-size:11px;color:#888;border-bottom:1px solid #2e2e2e;padding-bottom:10px;margin-bottom:20px;line-height:1.8;}
    .topic{margin:0 auto 20px;width:100%;}
    .topic h1{font-size:20px;font-weight:700;color:#e0e0e0;margin:0 0 8px;}
    .topic p,.topic li{color:#ccc;font-size:14px;line-height:1.7;margin:0 0 6px;}
    .topic-variation{margin:12px auto 20px;width:100%;}
    .topic-variation h2{font-size:15px;font-weight:600;color:#aaa;margin:0 0 8px;border-bottom:1px solid #2e2e2e;padding-bottom:6px;}
    .topic-variation p,.topic-variation li{color:#bbb;font-size:13px;line-height:1.7;margin:0 0 6px;}
    .summary{background:#111820;border:1px solid #4a9eff22;border-radius:8px;padding:10px 16px;margin-bottom:18px;font-size:12px;color:#9ab;line-height:1.6;}
    .summary-label{font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#4a9eff;margin-bottom:6px;}
    .conclusion{border:1px solid;border-radius:10px;padding:12px 16px;margin-bottom:14px;background:#161620;}
    .conc-label{font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;}
    .turn-badge{margin:16px 0 10px;}
    .msg{display:flex;flex-direction:column;max-width:82%;}
    .msg-left{align-self:flex-start;align-items:flex-start;}
    .msg-right{align-self:flex-end;align-items:flex-end;margin-left:auto;}
    .msg-center{align-self:center;align-items:center;max-width:92%;}
    .dice-row{display:flex;width:100%;margin:4px 0 10px;}
    .dice-row .dice-note{max-width:92%;}
    .presence-row{text-align:center;margin:10px 0;}
    .part-row{margin:2px 0;}
    a{color:#a78bfa;} a:hover{color:#c4b5fd;}
    .bubble a{text-decoration:underline;text-underline-offset:2px;}
    body > *{display:block;}
    .msgs{display:flex;flex-direction:column;gap:10px;}
  </style>
</head>
<body>
  <h1>AI Debate — Chat Export</h1>
  <div class="meta"><strong>Debate mode:</strong> ${esc(mode.labelEn)}${language ? ` &nbsp;·&nbsp; <strong>Language:</strong> ${esc(language)}` : ''}</div>
  <div class="meta">AI Debate v${esc(APP_VERSION)} &nbsp;·&nbsp; Endpoint: ${esc(baseUrl)} &nbsp;·&nbsp; ${esc(now)}<br>${partRows}</div>
  <div class="msgs">
  ${body}
  </div>
</body>
</html>`

    return html
  }

  static exportHTML(options) {
    const html = Data.buildHTML(options)
    const filename = `${Data.buildExportSlug(options.topic || '')}.html`
    Data.triggerDownload(html, filename, 'text/html;charset=utf-8')
  }

  static exportMD({ messages, participants, baseUrl, conclusions = [], topic = '', debateMode = DEFAULT_DEBATE_MODE, uiLang = '', constants }) {
    const {
      MOODS,
      MOOD_INTENSITY,
      DEFAULT_MOOD_INTENSITY,
      AGE_GROUPS,
      DEFAULT_AGE_GROUP,
      EDUCATION_LEVELS,
      CHARACTER_TYPES = [],
      RESPONSE_LENGTHS = [],
    } = constants

    const now = new Date().toLocaleString('it-IT')
    const mode = debateModeInfo(debateMode)
    const language = debateLanguageLabel(uiLang)
    const slug = Data.buildExportSlug(topic)
    const CONCLUSION_TYPE_LABEL = {
      summary: 'Summary',
      verdict: 'Verdict',
      contradictions: 'Contradictions',
      blindspot: 'Blindspots',
      next_steps: 'Next steps',
      custom: 'Prompt',
      considerations: 'Considerations',
    }

    const partList = participants.map(p => {
      const name = p.name ? ` (${p.name})` : ''
      const moderatorStr = p.isModerator ? ' · Moderator' : ''
      const char = CHARACTER_TYPES.find(c => c.value === (p.characterType ?? null))
      const charStr = ` · ${char?.label ?? 'Person'}`
      const resp = RESPONSE_LENGTHS.find(r => r.value === (p.responseLength ?? null))
      const respStr = ` · Verbosity: ${resp?.label ?? 'Free'}`
      const moodObj = MOODS.find(m => m.id === p.mood)
      const moodStr = moodObj?.instruction ? ` · ${moodObj.emoji} ${moodObj.label}` : ''
      const intensity = MOOD_INTENSITY[p.moodIntensity ?? DEFAULT_MOOD_INTENSITY]
      const intensityStr = moodObj?.instruction && intensity ? ` [${intensity.label}]` : ''
      const age = AGE_GROUPS[p.ageGroup ?? DEFAULT_AGE_GROUP]
      const ageStr = ` · ${age?.label ?? '-'}`
      const edu = EDUCATION_LEVELS.find(e => e.value === (p.educationLevel ?? null))
      const eduStr = edu?.instruction ? ` · ${edu.label}` : ''
      const epStr = p.endpointOverride?.trim() ? ' · EP' : ''
      return `- **${p.tag}**${name}${charStr}${respStr}${moodStr}${intensityStr}${eduStr}${ageStr}${epStr}${moderatorStr}`
    }).join('\n')

    let out = '# AI Debate — Export\n\n'
    out += `**Debate mode:** ${mode.labelEn}${language ? ` · **Language:** ${language}` : ''}\n\n`
    out += `**Data:** ${now}  \n**Endpoint:** ${baseUrl}  \n**App version:** ${APP_VERSION}\n\n`
    out += `## Participants\n${partList}\n\n---\n\n`

    const items = buildOrderedItems(messages.filter(msg => msg.role !== 'error'), conclusions)
    for (const item of items) {
      if (item.kind === 'conclusion') {
        const conclusion = item.c
        const typeLabel = conclusion.title || CONCLUSION_TYPE_LABEL[conclusion.type] || conclusion.type
        out += `### ${typeLabel}\n\n${conclusion.content}\n\n---\n\n`
        continue
      }

      const msg = item.msg
      if (msg.role === 'topic') {
        out += `> **Topic:** ${msg.content}\n\n`
        continue
      }
      if (msg.role === 'user') {
        out += `**Moderator:** ${msg.content}\n\n`
        continue
      }
      if (msg.role === 'interjection') {
        out += `**Variation:** ${msg.content}\n\n`
        continue
      }
      if (msg.role === 'dice') {
        const diceOwner = participants.find(participant => (
          (msg.diceOwner?.id != null && participant.id === msg.diceOwner.id)
          || (msg.diceOwner?.tag && participant.tag === msg.diceOwner.tag)
        )) || msg.participantSnapshot || msg.diceOwner || null
        const diceOwnerName = diceOwner?.name || diceOwner?.tag || 'Dice'
        out += `**🎲 ${diceOwnerName}** ${msg.content}\n\n`
        continue
      }
      if (msg.role === 'participant_left' || msg.role === 'participant_joined') {
        const snap = msg.participantSnapshot
        const isLeft = msg.role === 'participant_left'
        const displayName = snap?.name || snap?.tag || '?'
        out += `*${isLeft ? '←' : '→'} ${displayName} ${isLeft ? 'left' : 'joined'} the conversation*\n\n`
        continue
      }

      const actor = Data.resolveActor(msg, participants)
      if (!actor) continue
      const name = actor.name || actor.tag
      const moderationLabel = actor.isModerator && msg.messageType === 'moderation' ? ' · Moderazione' : ''
      out += `### ${name}${moderationLabel}\n\n${msg.content}\n\n---\n\n`
    }

    Data.triggerDownload(out, `${slug}.md`, 'text/markdown;charset=utf-8')
  }

  static exportJSON({ messages, participants, baseUrl, conclusions = [], summary = '', topic = '', debateMode = DEFAULT_DEBATE_MODE, uiLang = '', constants }) {
    const {
      MOODS,
      MOOD_INTENSITY,
      DEFAULT_MOOD_INTENSITY,
      AGE_GROUPS,
      DEFAULT_AGE_GROUP,
      EDUCATION_LEVELS,
      CHARACTER_TYPES = [],
      RESPONSE_LENGTHS = [],
    } = constants

    const slug = Data.buildExportSlug(topic)
    const mode = debateModeInfo(debateMode)
    const data = {
      exported: new Date().toISOString(),
      appVersion: APP_VERSION,
      debateMode: mode.id,
      debateModeLabel: mode.labelEn,
      language: uiLang || null,
      languageLabel: debateLanguageLabel(uiLang) || null,
      baseUrl,
      summary: summary || null,
      participants: participants.map(p => {
        const moodObj = MOODS.find(m => m.id === p.mood)
        const intensity = MOOD_INTENSITY[p.moodIntensity ?? DEFAULT_MOOD_INTENSITY]
        const age = AGE_GROUPS[p.ageGroup ?? DEFAULT_AGE_GROUP]
        const edu = EDUCATION_LEVELS.find(e => e.value === (p.educationLevel ?? null))
        const char = CHARACTER_TYPES.find(c => c.value === (p.characterType ?? null))
        const resp = RESPONSE_LENGTHS.find(r => r.value === (p.responseLength ?? null))
        return {
          tag: p.tag,
          name: p.name || null,
          isModerator: !!p.isModerator,
          characterType: char?.label ?? 'Person',
          responseLength: `Verbosity: ${resp?.label ?? 'Free'}`,
          mood: moodObj?.label ?? null,
          moodIntensity: intensity?.label ?? null,
          age: (p.ageGroup ?? DEFAULT_AGE_GROUP) !== DEFAULT_AGE_GROUP ? age?.label : null,
          education: edu?.instruction ? edu.label : null,
          endpointOverride: p.endpointOverride?.trim() || null,
        }
      }),
      messages: messages.filter(m => m.role !== 'error').map(m => {
        const actor = Data.resolveActor(m, participants)
        return {
          role: m.role,
          turn: m.turn ?? null,
          content: m.content,
          actor: actor ? (actor.name || actor.tag) : null,
          actorIsModerator: !!actor?.isModerator,
          messageType: m.messageType ?? null,
          kind: actor?.isModerator && m.messageType === 'moderation' ? 'moderation' : 'message',
          dice: m.dice ?? null,
        }
      }),
      conclusions: conclusions.map(({ type, title, customPrompt, content, createdAt, seq }) => ({ type, title: title ?? null, customPrompt: customPrompt ?? null, content, createdAt, seq })),
    }

    Data.triggerDownload(JSON.stringify(data, null, 2), `${slug}.json`, 'application/json;charset=utf-8')
  }
}
