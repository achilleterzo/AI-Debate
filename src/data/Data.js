import { marked } from 'marked'
import { topicToSlug } from '../utils/Slug'
import { buildOrderedItems } from '../utils/Sorting'

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

  static exportHTML({
    messages,
    participants,
    baseUrl,
    conclusions = [],
    topic = '',
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
    const md = s => marked.parse(s || '', { breaks: true })
    const now = new Date().toLocaleString('it-IT')

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

    let lastTurn = null
    let body = ''

    for (const item of items) {
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
        body += `<div class="msg msg-right"><div class="label" style="color:#f97316;text-align:right">User</div><div class="bubble" style="background:#2a1f1f;border:1px solid #f97316aa;border-radius:12px 12px 2px 12px;">${md(msg.content)}</div></div>`
        continue
      }

      if (msg.role === 'interjection') {
        body += `<div class="topic-variation"><h2>↳ Variation</h2>${md(msg.content)}</div>`
        continue
      }

      if (msg.role === 'participant_left' || msg.role === 'participant_joined') {
        const snap = msg.participantSnapshot
        const isLeft = msg.role === 'participant_left'
        const displayName = esc(snap?.name || snap?.tag || '?')
        body += `<div style="text-align:center;margin:10px 0;"><div style="display:inline-flex;align-items:center;gap:8px;background:${isLeft ? '#1a1212' : '#121a12'};border:1px solid ${isLeft ? '#7a2a2a44' : '#2a7a2a44'};border-radius:20px;padding:5px 14px;font-size:11px;color:${isLeft ? '#aa5555' : '#55aa55'};letter-spacing:.3px;"><span style="opacity:.6">${isLeft ? '←' : '→'}</span><span style="font-weight:700;color:${snap?.label || '#888'}">${displayName}</span><span>${isLeft ? 'has left the conversation' : 'has joined the conversation'}</span></div></div>`
        continue
      }

      const actor = Data.resolveActor(msg, participants)
      if (!actor) continue

      if (msg.turn !== lastTurn && msg.turn) {
        lastTurn = msg.turn
        body += `<div class="turn-badge">— round ${msg.turn} —</div>`
      }

      const isLeft = actor.radiusOwn === '12px 12px 12px 2px'
      const radius = actor.radiusOwn || '12px'
      const name = esc(actor.name || actor.tag)
      const alignClass = actor.isModerator ? 'msg-center' : (isLeft ? 'msg-left' : 'msg-right')
      const moderatorBadge = actor.isModerator ? '<div class="moderation-badge">Moderazione</div>' : ''
      const radiusFinal = actor.isModerator ? '12px' : radius

      body += `<div class="msg ${alignClass}"><div class="label" style="color:${actor.label}">${name}</div><div class="bubble" style="background:${actor.isModerator ? '#2a180f' : actor.bg};border:${actor.isModerator ? '2px dashed #fb923ccc' : `1px solid ${actor.border}`};border-radius:${radiusFinal};">${moderatorBadge}${md(msg.content)}</div></div>`
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>AI Debate — Export ${now}</title>
  <style>
    *{box-sizing:border-box;}
    body{margin:0;padding:28px 32px;background:#141414;color:#e0e0e0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;max-width:900px;margin-left:auto;margin-right:auto;}
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
    .turn-badge{text-align:center;font-size:11px;color:#444;margin:16px 0 10px;letter-spacing:.5px;}
    .msg{margin-bottom:14px;display:flex;flex-direction:column;max-width:82%;}
    .msg-left{align-self:flex-start;align-items:flex-start;}
    .msg-right{align-self:flex-end;align-items:flex-end;margin-left:auto;}
    .msg-center{align-self:center;align-items:center;max-width:92%;}
    .label{font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;margin-bottom:4px;}
    .bubble{padding:10px 14px;font-size:13px;line-height:1.65;word-break:break-word;}
    .moderation-badge{display:inline-block;background:#2a180f;border:1px solid #f9731655;border-radius:999px;padding:2px 8px;font-size:10px;color:#fb923c;font-weight:700;letter-spacing:.4px;text-transform:uppercase;margin-bottom:6px;}
    .part-row{margin:2px 0;}
    .bubble p{margin:0 0 8px;} .bubble p:last-child{margin:0;}
    .bubble ul,.bubble ol{margin:6px 0 6px 20px;padding:0;} .bubble li{margin-bottom:3px;}
    .bubble h1,.bubble h2,.bubble h3{margin:10px 0 4px;font-size:14px;color:#fff;}
    .bubble code{background:#0f0f0f;border:1px solid #2e2e2e;border-radius:3px;padding:1px 5px;font-family:monospace;font-size:12px;}
    .bubble pre{background:#0f0f0f;border:1px solid #2e2e2e;border-radius:6px;padding:10px;overflow-x:auto;margin:8px 0;}
    .bubble pre code{background:none;border:none;padding:0;}
    .bubble blockquote{border-left:3px solid #444;margin:6px 0;padding:4px 10px;color:#888;}
    .bubble strong{color:#fff;} .bubble a{color:#a78bfa;text-decoration:underline;text-underline-offset:2px;}
    a{color:#a78bfa;} a:hover{color:#c4b5fd;}
    .bubble table{border-collapse:collapse;width:100%;margin:10px 0;font-size:12px;}
    .bubble th{background:#1e1e2e;color:#c4b5fd;font-weight:600;padding:6px 10px;border:1px solid #3a3a5a;text-align:left;}
    .bubble td{padding:5px 10px;border:1px solid #2e2e2e;color:#ccc;vertical-align:top;}
    .bubble tr:nth-child(even) td{background:#1a1a1a;}
    body > *{display:block;}
    .msgs{display:flex;flex-direction:column;gap:0;}
  </style>
</head>
<body>
  <h1>AI Debate — Chat Export</h1>
  <div class="meta">Endpoint: ${esc(baseUrl)} &nbsp;·&nbsp; ${esc(now)}<br>${partRows}</div>
  <div class="msgs">
  ${body}
  </div>
</body>
</html>`

    const filename = `${Data.buildExportSlug(topic)}.html`
    Data.triggerDownload(html, filename, 'text/html;charset=utf-8')
  }

  static exportMD({ messages, participants, baseUrl, conclusions = [], topic = '', constants }) {
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
    out += `**Data:** ${now}  \n**Endpoint:** ${baseUrl}\n\n`
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
      const moderationLabel = actor.isModerator ? ' · Moderazione' : ''
      out += `### ${name}${moderationLabel}\n\n${msg.content}\n\n---\n\n`
    }

    Data.triggerDownload(out, `${slug}.md`, 'text/markdown;charset=utf-8')
  }

  static exportJSON({ messages, participants, baseUrl, conclusions = [], summary = '', topic = '', constants }) {
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
    const data = {
      exported: new Date().toISOString(),
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
          kind: actor?.isModerator ? 'moderation' : 'message',
        }
      }),
      conclusions: conclusions.map(({ type, title, customPrompt, content, createdAt, seq }) => ({ type, title: title ?? null, customPrompt: customPrompt ?? null, content, createdAt, seq })),
    }

    Data.triggerDownload(JSON.stringify(data, null, 2), `${slug}.json`, 'application/json;charset=utf-8')
  }
}
