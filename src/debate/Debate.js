import { RANDOM_NAMES } from '../dataset/RandomNames'
import { UI_LANGUAGE_OPTIONS as LANGUAGES } from '../i18n/UiStrings'
import { PALETTE } from '../dataset/Palette'
import { Session } from '../data/Session'
import { buildSystemPrompt } from './PromptBuilder'
import { streamChat } from './Stream'
import { Web } from '../services/Web'
import { MOODS } from '../prompts/Moods'
import { MOOD_INTENSITY } from '../prompts/MoodIntensity'
import { RESPONSE_LENGTHS } from '../prompts/ResponseLengths'
import { EDUCATION_LEVELS } from '../prompts/EducationLevels'
import { AGE_GROUPS } from '../prompts/AgeGroups'
import { CHARACTER_TYPES } from '../dataset/CharacterTypes'

export class Debate {
  static CONCLUSION_CONVERSATION_LIMIT = 8000

  static CONCLUSION_MESSAGE_LIMIT = 600

  static CONCLUSION_ATTACHMENT_LIMIT = 2200

  static DOCUMENT_SUMMARY_WORD_LIMIT = 450

  static DEFAULT_MOOD = 'diplomatic'

  static USER_MODEL = '__user__'

  static DEFAULT_MOOD_INTENSITY = 2

  static DEFAULT_EDUCATION_LEVEL = null

  static DEFAULT_AGE_GROUP = 2

  static detectBrowserLang() {
    const lang = (navigator.language || navigator.languages?.[0] || 'en').slice(0, 2).toLowerCase()
    return LANGUAGES.find(option => option.code === lang)?.code ?? 'en'
  }

  static randomName(usedNames = []) {
    const available = RANDOM_NAMES.filter(name => !usedNames.includes(name))
    const pool = available.length > 0 ? available : RANDOM_NAMES
    return pool[Math.floor(Math.random() * pool.length)]
  }

  static mkParticipant(idx, model = '') {
    return {
      id: idx,
      model,
      endpointOverride: '',
      name: '',
      isModerator: false,
      moderatorAlwaysIntervene: false,
      moderatorDynamicAffinity: false,
      moderatorFactCheck: false,
      moderatorEnforceTopic: false,
      mood: Debate.DEFAULT_MOOD,
      moodIntensity: Debate.DEFAULT_MOOD_INTENSITY,
      affinity: {},
      affinityLocks: {},
      characterType: null,
      responseLength: null,
      educationLevel: Debate.DEFAULT_EDUCATION_LEVEL,
      ageGroup: Debate.DEFAULT_AGE_GROUP,
      constraints: [],
      characterContext: null,
      ...PALETTE[idx % PALETTE.length],
    }
  }

  static roundAffinity(value) {
    return Math.round(value * 100) / 100
  }

  static clampAffinity(value) {
    if (value > 1) return 1
    if (value < -1) return -1
    return value
  }

  static normalizeAffinity(raw) {
    if (Array.isArray(raw)) {
      const out = {}
      for (const id of raw) {
        const numericId = Number(id)
        if (Number.isFinite(numericId)) out[numericId] = 1
      }
      return out
    }

    if (!raw || typeof raw !== 'object') return {}

    const out = {}
    for (const [key, value] of Object.entries(raw)) {
      const id = Number(key)
      const weight = Number(value)
      if (!Number.isFinite(id) || !Number.isFinite(weight)) continue
      const clamped = Debate.clampAffinity(weight)
      if (clamped !== 0) out[id] = Debate.roundAffinity(clamped)
    }
    return out
  }

  static normalizeAffinityLocks(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}

    const out = {}
    for (const [key, value] of Object.entries(raw)) {
      const id = Number(key)
      if (!Number.isFinite(id)) continue
      if (value === true) out[id] = true
    }
    return out
  }

  static parseAffinityDeltas(raw) {
    if (!raw) return null

    const cleaned = String(raw)
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()

    try {
      const parsed = JSON.parse(cleaned)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null

      const out = {}
      for (const [fromTag, row] of Object.entries(parsed)) {
        if (!row || typeof row !== 'object' || Array.isArray(row)) continue
        out[fromTag] = {}
        for (const [toTag, deltaRaw] of Object.entries(row)) {
          const delta = Number(deltaRaw)
          if (!Number.isFinite(delta) || delta === 0) continue
          out[fromTag][toTag] = Debate.roundAffinity(Debate.clampAffinity(delta))
        }
      }
      return out
    } catch {
      return null
    }
  }

  static parseSummaryAffinityBundle(raw) {
    if (!raw) return null

    const cleaned = String(raw)
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()

    try {
      const parsed = JSON.parse(cleaned)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null

      const summary = String(parsed.summary ?? '').trim()
      const deltas = Debate.parseAffinityDeltas(JSON.stringify(parsed.affinity_deltas ?? {})) || {}
      const moderation = parsed.moderation && typeof parsed.moderation === 'object'
        ? {
            needed: !!parsed.moderation.needed,
            reason: String(parsed.moderation.reason || '').trim(),
          }
        : { needed: false, reason: '' }

      if (!summary) return null
      return { summary, deltas, moderation }
    } catch {
      return null
    }
  }

  static getActiveTopicMessage(history = []) {
    return [...history].reverse().find(message => (message.role === 'interjection' || message.role === 'topic') && message.content?.trim()) || null
  }

  static detectTopicDrift({ history = [], messages = [] }) {
    const activeTopic = Debate.getActiveTopicMessage(history)
    if (!activeTopic?.content?.trim() || messages.length === 0) return { detected: false, reason: '' }

    const topicText = activeTopic.content.toLowerCase()
    const roundText = messages.map(message => String(message.content || '')).join('\n\n').toLowerCase()

    const wholeSubjectFocus = /\b(opinion|project|website|site|webzine|initiative|about)\b/.test(topicText)
    if (!wholeSubjectFocus) return { detected: false, reason: '' }

    const wholeSubjectAnchors = ['project', 'website', 'site', 'webzine', 'editorial', 'coverage', 'mission', 'publication', 'initiative', 'opinion']
    const anchorHits = wholeSubjectAnchors.filter(anchor => roundText.includes(anchor)).length

    const detailMentions = [
      ...String(messages.map(message => message.content || '').join('\n\n')).matchAll(/"([^"]{3,})"/g),
      ...String(messages.map(message => message.content || '').join('\n\n')).matchAll(/\*\*([^*]{3,})\*\*/g),
    ]
    const uniqueDetails = new Set(detailMentions.map(match => String(match[1] || '').trim().toLowerCase()).filter(Boolean))

    const detected = uniqueDetails.size >= 2 && anchorHits === 0
    return {
      detected,
      reason: detected ? 'participants drifted from the overall topic into specific side details without reconnecting them to the main subject' : '',
    }
  }

  static detectUnsupportedAssumptionDrift({ messages = [] }) {
    if (messages.length === 0) return { detected: false, reason: '' }

    const text = messages.map(message => String(message.content || '')).join('\n\n').toLowerCase()
    const assumptionSignals = [
      'traffic',
      'click',
      'clickbait',
      'analytics',
      'business model',
      'strategy of survival',
      'strategia di sopravvivenza',
      'wants traffic',
      'vuole traffico',
      'intention',
      'intent',
      'motivation',
      'motive',
      'opportunism',
      'parasitism',
      'parassitismo',
      'not paid collaborators',
      'collaboratori non pagati',
    ]
    const evidenceSignals = [
      'homepage',
      'home page',
      'about page',
      'about us',
      'mission',
      'declares',
      'states',
      'homepage says',
      'the site says',
      'they declare',
      'declara',
      'dice',
      'dichiara',
      'testo',
      'pagina',
      'source',
      'fonte',
      'report',
      'article',
      'articolo',
    ]

    const assumptionHits = assumptionSignals.filter(signal => text.includes(signal)).length
    const evidenceHits = evidenceSignals.filter(signal => text.includes(signal)).length
    const detected = assumptionHits >= 2 && evidenceHits === 0

    return {
      detected,
      reason: detected ? 'participants are making undocumented inferences about motives, traffic, or internal strategy instead of staying with observable evidence' : '',
    }
  }

  static sessionConstants() {
    return {
      mkParticipant: Debate.mkParticipant,
      DEFAULT_MOOD: Debate.DEFAULT_MOOD,
      DEFAULT_MOOD_INTENSITY: Debate.DEFAULT_MOOD_INTENSITY,
      DEFAULT_EDUCATION_LEVEL: Debate.DEFAULT_EDUCATION_LEVEL,
      DEFAULT_AGE_GROUP: Debate.DEFAULT_AGE_GROUP,
      normalizeAffinity: Debate.normalizeAffinity,
      normalizeAffinityLocks: Debate.normalizeAffinityLocks,
    }
  }

  static hydrateParticipantsFromSession(participants = []) {
    return participants.map((participant, index) => Session.hydrateParticipant(participant, index, Debate.sessionConstants()))
  }

  static serializeParticipantsForSession(participants = []) {
    return participants.map(participant => Session.serializeParticipant(participant, Debate.sessionConstants()))
  }

  static reindexParticipants(participants = []) {
    return participants.map((participant, index) => ({
      ...Debate.mkParticipant(index, participant.model),
      endpointOverride: participant.endpointOverride ?? '',
      name: participant.name,
      isModerator: !!participant.isModerator || participant.mood === 'moderator',
      moderatorAlwaysIntervene: !!participant.moderatorAlwaysIntervene,
      moderatorDynamicAffinity: !!participant.moderatorDynamicAffinity,
      moderatorEnforceTopic: !!participant.moderatorEnforceTopic,
      moderatorFactCheck: !!participant.moderatorFactCheck,
      mood: participant.mood,
      moodIntensity: participant.moodIntensity ?? Debate.DEFAULT_MOOD_INTENSITY,
      characterType: participant.characterType ?? null,
      responseLength: participant.responseLength ?? null,
      educationLevel: participant.educationLevel ?? Debate.DEFAULT_EDUCATION_LEVEL,
      ageGroup: participant.ageGroup ?? Debate.DEFAULT_AGE_GROUP,
      affinity: Debate.normalizeAffinity(participant.affinity),
      affinityLocks: Debate.normalizeAffinityLocks(participant.affinityLocks),
      constraints: participant.constraints ?? [],
      characterContext: participant.characterContext ?? null,
    }))
  }

  static parseConclusionList(text) {
    if (!text) return []
    return String(text)
      .split('\n')
      .map(line => line.trim())
      .map(line => line.replace(/^[-*•]\s+/, '').replace(/^\d+[.)]\s+/, '').trim())
      .filter(Boolean)
  }

  static buildConclusionConversation(history = [], participants = [], { limit = Debate.CONCLUSION_CONVERSATION_LIMIT, messageLimit = Debate.CONCLUSION_MESSAGE_LIMIT } = {}) {
    const lines = history
      .filter(message => !['error', 'topic', 'interjection', 'pending'].includes(message.role) && message.content?.trim())
      .map(message => {
        if (message.role === 'user') return `Moderator: ${message.content.slice(0, messageLimit)}`
        const participant = participants.find(entry => entry.tag === message.role)
        return `${participant?.name || participant?.tag || message.role}: ${message.content.slice(0, messageLimit)}`
      })

    let full = lines.join('\n\n')
    if (full.length > limit) full = '…[conversation truncated]\n\n' + full.slice(full.length - limit)
    return full
  }

  static getLatestConclusionByType(conclusions = [], type) {
    return [...conclusions].reverse().find(conclusion => conclusion.type === type)?.content ?? null
  }

  static getPreviousConclusion(conclusions = [], { type, model, customPrompt }) {
    return [...conclusions].reverse().find(conclusion => conclusion.type === type && conclusion.model === model && (type !== 'custom' || (conclusion.customPrompt || '') === customPrompt))?.content ?? null
  }

  static buildConclusionAttachments(attachedDocs = [], limit = Debate.CONCLUSION_ATTACHMENT_LIMIT) {
    return attachedDocs.map(doc => ({
      name: doc.name,
      truncated: !!doc.truncated || (doc.content || '').length > limit,
      content: (doc.content || '').slice(0, limit),
    }))
  }

  static buildConclusionContext({
    conversation,
    attachedDocs = [],
    conclusions = [],
    summary = null,
    type,
    model,
    customPrompt,
  }) {
    const docsForConclusion = Debate.buildConclusionAttachments(attachedDocs)
    return {
      conversation,
      attachments: docsForConclusion.length > 0 ? docsForConclusion : null,
      summary: Debate.getLatestConclusionByType(conclusions, 'summary') || summary || null,
      considerations: Debate.getLatestConclusionByType(conclusions, 'considerations') || null,
      contradictions: Debate.parseConclusionList(Debate.getLatestConclusionByType(conclusions, 'contradictions')),
      blindspots: Debate.parseConclusionList(Debate.getLatestConclusionByType(conclusions, 'blindspot')),
      next_steps: Debate.parseConclusionList(Debate.getLatestConclusionByType(conclusions, 'next_steps')),
      previous_output: Debate.getPreviousConclusion(conclusions, { type, model, customPrompt }) || null,
    }
  }

  static buildConclusionPrompt({ conclusionType, context, customPrompt = '', standardPrompt = '' }) {
    const ctxJson = JSON.stringify(context, null, 2)
    const baseConclusionPrompt = conclusionType.prompt(ctxJson, customPrompt)
    return conclusionType.id !== 'custom' && standardPrompt
      ? `${baseConclusionPrompt}\n\nAdditional guidance (HIGH PRIORITY):\n${standardPrompt}\n\nThis guidance must strongly steer the output to better match the target objective for this conclusion type.`
      : baseConclusionPrompt
  }

  static shouldRewriteConclusionResult(result, uiLang) {
    const leakedReasoning = /\b(the user is asking|let me analyze|i need to|now i need to|here'?s my analysis)\b/i.test(result)
    const wrongLangHint = uiLang === 'it' && /\b(the|and|therefore|however|considerations|contradictions|blindspots|next steps)\b/i.test(result.slice(0, 600))
    return !!result && (leakedReasoning || wrongLangHint)
  }

  static pickOperationalModel(parts = [], overrideEnabled = false, overrideValue = '') {
    if (overrideEnabled && overrideValue) return overrideValue
    return parts.find(participant => participant.model && participant.model !== Debate.USER_MODEL)?.model ?? parts[0]?.model ?? ''
  }

  static buildLanguageLabel(uiLang, languages = []) {
    return languages.find(language => language.code === uiLang)?.label ?? uiLang
  }

  static buildDocumentSummarySystemPrompt(uiLang, languages = []) {
    return `You are a precise analytical summarizer. Output only the requested summary, no preamble. Write in ${Debate.buildLanguageLabel(uiLang, languages)} (language code: ${uiLang}).`
  }

  static buildDocumentSummaryPrompt(document) {
    return `Create an analytical summary of this full document for debate preparation. Include: core thesis, claims, assumptions, constraints, risks, contradictions, and practical implications. Keep it dense but readable (max ~${Debate.DOCUMENT_SUMMARY_WORD_LIMIT} words).\n\nDocument name: ${document.name}\n\nDocument content:\n${document.content}`
  }

  static computeRoundLimit({ hasResumeMessages, currentRoundLimit, maxRounds, extraRounds = 0 }) {
    if (!hasResumeMessages) return maxRounds === 0 ? 0 : maxRounds
    const savedLimit = currentRoundLimit > 0 ? currentRoundLimit : maxRounds
    return savedLimit === 0 ? 0 : savedLimit + extraRounds
  }

  static createInitialHistory({ history = [], injectTopic, round, nextSeq }) {
    if (history.length === 0) {
      const topicMsg = { role: 'topic', ollamaRole: 'user', content: injectTopic ?? '', turn: 0, seq: nextSeq() }
      return { history: [topicMsg], round: 0, step: 0, seededMessages: [topicMsg] }
    }

    if (injectTopic) {
      const userMsg = { role: 'interjection', ollamaRole: 'user', content: injectTopic, turn: round, seq: nextSeq() }
      const nextHistory = [...history, userMsg]
      return { history: nextHistory, round, step: null, seededMessages: nextHistory }
    }

    return { history, round, step: null, seededMessages: null }
  }

  static isFirstDebateTurn(history = []) {
    return history.filter(message => !['topic', 'interjection', 'participant_joined', 'participant_left', 'error'].includes(message.role)).length === 0
  }

  static buildRoundSummarySystemPrompt(uiLang, languages = []) {
    return `You are a concise summarizer. Output only the requested summary text, no preamble, no commentary, no tool calls, no markdown headings. Write in ${Debate.buildLanguageLabel(uiLang, languages)} (language code: ${uiLang}).`
  }

  static buildRoundSummaryPrompt({
    parts = [],
    prevSummary = '',
    summaryAccumulate = false,
    summaryAccumulateThreshold = 8,
    moderatorInterventionThisRound = false,
    toSummarize = '',
  }) {
    const participantsList = parts.map(participant => `${participant.tag}: ${participant.name || participant.tag}`).join('\n')
    const thresholdBytes = summaryAccumulateThreshold * 1024
    const summaryMode = summaryAccumulate && prevSummary
      ? `ACCUMULATE mode is ON. If previous_summary exceeds ${thresholdBytes} characters, compact it first, then append only a concise paragraph for new exchanges. Otherwise append directly.`
      : 'STANDARD mode: produce an updated concise summary including new exchanges.'

    return `Return ONLY strict JSON (no markdown, no prose) with exact shape:\n{\n  "summary": "<updated summary text>",\n  "affinity_deltas": { "A": { "B": -0.20 }, "B": { "A": 0.15 } },\n  "moderation": { "needed": false, "reason": "" }\n}\n\nRules for affinity_deltas:\n- keys are participant TAGS only\n- values are round deltas in [-1.00, +1.00]\n- use 0 or omit when unsure\n- no self links\n- do not invent tags\n${moderatorInterventionThisRound ? '- A moderator intervened in this round: bias deltas toward de-escalation (reduce absolute affinity values unless strong evidence suggests otherwise).' : ''}\n\nRules for moderation:\n- Set moderation.needed=true only when moderation is concretely needed now (personal attacks, escalation, severe off-topic drift, unsupported speculation presented as fact, or explicit request for moderation).\n- Keep reason short and specific.\n\nSummary policy:\n${summaryMode}\n\nParticipants:\n${participantsList}\n\nPrevious summary:\n${prevSummary || '(none)'}\n\nNew exchanges in current round:\n${toSummarize}`
  }

  static buildPromptConstants() {
    return {
      MOODS,
      DEFAULT_MOOD: Debate.DEFAULT_MOOD,
      MOOD_INTENSITY,
      DEFAULT_MOOD_INTENSITY: Debate.DEFAULT_MOOD_INTENSITY,
      CHARACTER_TYPES,
      RESPONSE_LENGTHS,
      EDUCATION_LEVELS,
      AGE_GROUPS,
      DEFAULT_AGE_GROUP: Debate.DEFAULT_AGE_GROUP,
      LANGUAGES,
    }
  }

  static async resolveCharacterContext({ actor, baseUrl, timeoutMs = 30_000, onEstimate = null }) {
    const characterType = CHARACTER_TYPES.find(entry => entry.value === actor.characterType)
    if (!characterType || !actor.name) return null
    const systemPrompt = 'You are a knowledge assistant. When asked about a person, provide a concise factual profile useful for roleplay and debate simulation.'
    const userMsg = `Provide a concise personality and background profile of the ${characterType.labelEn} known as "${actor.name}". Include: their known values, beliefs, communication style, notable positions or works, and any distinctive speech patterns or rhetorical habits. Be factual and specific. Keep it under 300 words.`
    try {
      let result = ''
      await streamChat({
        baseUrl,
        model: actor.model,
        messages: [{ ollamaRole: 'user', content: userMsg }],
        systemPrompt,
        useTools: false,
        onToken: token => { result = token },
        timeoutMs,
        onEstimate,
      })
      return result.trim() || null
    } catch (err) {
      console.warn(`[resolveCharacterContext] failed for "${actor.name}":`, err.message)
      return null
    }
  }

  static isModerationDirectiveStyle(text) {
    const normalized = String(text || '').trim().toLowerCase()
    if (!normalized) return false
    const lines = normalized.split('\n').map(line => line.trim()).filter(Boolean)
    const hasStructuredShape = lines.length >= 3 && (/:/.test(lines[0]) || /^[-*•]/.test(lines[0]))
    const hasActionVerb = /must|should|need to|deve|dovete|interrompiamo|evitiamo|chiarite|rispondi|focalizzate|fornisci|indica|limitiamo|sollte|deben|il faut|deve(m|n)?/.test(normalized)
    const looksLikeNarrativeSummary = /da un lato|dall['’]altro|in realt[aà]|forse la chiave|entrambe le prospettive|punto di incontro/.test(normalized)
    return (hasStructuredShape || hasActionVerb) && !looksLikeNarrativeSummary
  }

  static updateConclusionConv(history, participants, conclusionConvRef) {
    conclusionConvRef.current = Debate.buildConclusionConversation(history, participants)
  }

  static applyDynamicAffinityUpdates({ participants = [], deltas = {}, moderatorIntervention = false, moderationCooling = 0 }) {
    if (!deltas || Object.keys(deltas).length === 0 || participants.length <= 1) {
      return { changed: false, participants }
    }

    const byTag = Object.fromEntries(participants.map(participant => [participant.tag, participant]))
    let changed = false
    const updated = participants.map(participant => {
      if (participant.isModerator && !participant.moderatorDynamicAffinity) return participant

      const row = deltas[participant.tag]
      const affinity = Debate.normalizeAffinity(participant.affinity)
      const locks = Debate.normalizeAffinityLocks(participant.affinityLocks)
      const touchedTargets = new Set()
      let rowChanged = false

      if (row && typeof row === 'object') {
        for (const [toTag, delta] of Object.entries(row)) {
          const target = byTag[toTag]
          if (!target || target.id === participant.id) continue
          if (locks[target.id]) continue

          const prev = Number(affinity[target.id] ?? 0)
          const next = Debate.roundAffinity(Debate.clampAffinity(prev + Number(delta)))
          touchedTargets.add(target.id)
          if (next === 0) {
            if (affinity[target.id] !== undefined) {
              delete affinity[target.id]
              rowChanged = true
            }
          } else if (affinity[target.id] !== next) {
            affinity[target.id] = next
            rowChanged = true
          }
        }
      }

      if (moderatorIntervention && (!participant.isModerator || participant.moderatorDynamicAffinity)) {
        for (const target of participants) {
          if (target.id === participant.id) continue
          if (locks[target.id]) continue
          if (touchedTargets.has(target.id)) continue

          const prev = Number(affinity[target.id] ?? 0)
          if (prev === 0) continue

          const cooled = Debate.roundAffinity(prev > 0 ? Math.max(0, prev - moderationCooling) : Math.min(0, prev + moderationCooling))
          if (cooled === 0) delete affinity[target.id]
          else affinity[target.id] = cooled
          if (cooled !== prev) rowChanged = true
        }
      }

      if (!rowChanged) return participant
      changed = true
      return { ...participant, affinity, affinityLocks: locks }
    })

    return { changed, participants: updated }
  }

  static shouldModeratorIntervene({ actor, history = [], participants = [], roundModerationSignal = null }) {
    const result = {
      shouldIntervene: false,
    }

    if (!actor?.isModerator) return result

    const nonModeratorMsgs = history.filter(message => {
      if (!message.role || ['topic', 'interjection', 'participant_joined', 'participant_left', 'error', 'user'].includes(message.role)) return false
      const participant = participants.find(entry => entry.tag === message.role)
      return !!participant && !participant.isModerator && !!String(message.content || '').trim()
    })

    const hasContext = nonModeratorMsgs.length > 0
    const moderationRequested = !!roundModerationSignal?.needed

    result.shouldIntervene = actor.moderatorAlwaysIntervene
      ? hasContext
      : hasContext && moderationRequested && !!actor.moderatorEnforceTopic

    return result
  }

  static buildParticipantLifecycleMessages({ history = [], participants = [], actor, turn, nextSeq }) {
    const latestEvents = new Map()
    for (const message of history) {
      if (!['participant_joined', 'participant_left'].includes(message.role)) continue
      const id = message.participantSnapshot?.id
      if (typeof id === 'number') latestEvents.set(id, message)
    }

    const messages = []
    const activeIds = new Set(participants.map(participant => participant.id))
    for (const [id, message] of latestEvents) {
      if (message.role === 'participant_joined' && !activeIds.has(id)) {
        messages.push({
          role: 'participant_left',
          ollamaRole: 'system',
          content: '',
          turn,
          seq: nextSeq(),
          participantSnapshot: message.participantSnapshot,
        })
      }
    }

    if (actor.model === Debate.USER_MODEL) return messages

    const previous = latestEvents.get(actor.id)
    const hasChanged = previous?.role === 'participant_joined' && (
      previous.participantSnapshot.model !== actor.model ||
      previous.participantSnapshot.name !== actor.name ||
      !!previous.participantSnapshot.isModerator !== !!actor.isModerator ||
      (previous.participantSnapshot.endpointOverride ?? '') !== (actor.endpointOverride ?? '')
    )

    if (hasChanged) {
      messages.push({
        role: 'participant_left',
        ollamaRole: 'system',
        content: '',
        turn,
        seq: nextSeq(),
        participantSnapshot: previous.participantSnapshot,
      })
    }

    if (!previous || previous.role === 'participant_left' || hasChanged) {
      messages.push({
        role: 'participant_joined',
        ollamaRole: 'system',
        content: '',
        turn,
        seq: nextSeq(),
        participantSnapshot: { ...actor },
      })
    }

    return messages
  }

  static escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  static async start({
    resumeMessages,
    resumeRound,
    resumeSummary,
    injectTopic,
    extraRounds = 0,
    runtime,
  }) {
    const {
      stopRef,
      setStopping,
      setRunning,
      participantsRef,
      maxTurnsRef,
      timeoutSecRef,
      baseUrlRef,
      useSummaryRef,
      attachedDocs,
      summarizeAttachments,
      summaryModelEnabled,
      summaryModelOverride,
      uiLang,
      handlePromptEstimate,
      characterContextRef,
      fetchedUrlsRef,
      setMessages,
      roundLimitRef,
      nextSeq,
      seqRef,
      summaryRef,
      summaryAccumulate,
      summaryAccumulateThreshold,
      debugMode,
      setSummaryInProgress,
      setSummary,
      dynamicAffinity,
      moderationCooling,
      setParticipants,
      setSummaryDebug,
      setStreamingSeq,
      setStreamingRole,
      globalConstraints,
      generalPersonalityInstructions,
      userInputRejectRef,
      setUserInputPending,
      turnRef,
      interjectRef,
      conclusionConvRef,
    } = runtime

    stopRef.current = false
    setStopping(false)
    setRunning(true)

    let parts = participantsRef.current
    const maxRounds = maxTurnsRef.current
    const timeoutMs = timeoutSecRef.current * 1000
    const baseUrl = baseUrlRef.current
    const useSummary = useSummaryRef.current
    const docs = attachedDocs
    let docsForPrompt = docs

    if (summarizeAttachments && docs.length > 0) {
      const summaryModel = Debate.pickOperationalModel(parts, summaryModelEnabled, summaryModelOverride)
      if (summaryModel) {
        try {
          const docSystem = Debate.buildDocumentSummarySystemPrompt(uiLang, LANGUAGES)
          const summarized = []
          for (const doc of docs) {
            let sum = ''
            await streamChat({
              baseUrl,
              model: summaryModel,
              useTools: false,
              timeoutMs,
              onEstimate: handlePromptEstimate,
              systemPrompt: docSystem,
              messages: [{ ollamaRole: 'user', content: Debate.buildDocumentSummaryPrompt(doc) }],
              onToken: token => { sum = token },
            })
            summarized.push({ ...doc, content: (sum || doc.content).trim() || doc.content })
          }
          docsForPrompt = summarized
          console.log('[attachments] analytical summaries prepared', { count: summarized.length, model: summaryModel })
        } catch (err) {
          console.warn('[attachments] summary failed, using raw docs:', err?.message || err)
          docsForPrompt = docs
        }
      }
    }

    if (!resumeMessages) {
      characterContextRef.current = {}
      fetchedUrlsRef.current = {}
      Web.clearCaches()
    }

    let history = resumeMessages ?? []
    let round = resumeRound?.round ?? 0
    let step = resumeRound?.step ?? 0
    let skipSummaryOnce = resumeRound?.skipSummary ?? false
    summaryRef.current = resumeSummary ?? ''

    const roundLimit = Debate.computeRoundLimit({
      hasResumeMessages: !!resumeMessages,
      currentRoundLimit: roundLimitRef.current,
      maxRounds,
      extraRounds,
    })
    roundLimitRef.current = roundLimit

    if (history.length === 0) {
      seqRef.current = 0
      const seeded = Debate.createInitialHistory({ history, injectTopic, round, nextSeq })
      history = seeded.history
      setMessages([...seeded.seededMessages])
      round = 0
      step = 0
    } else if (injectTopic) {
      const seeded = Debate.createInitialHistory({ history, injectTopic, round, nextSeq })
      history = seeded.history
      setMessages([...history])
    }

    outer: while (true) {
      parts = participantsRef.current
      if (stopRef.current) break
      if (roundLimit > 0 && round >= roundLimit && step === 0) break

      let roundModerationSignal = { needed: false, reason: '' }

      {
        const isFirstTurn = Debate.isFirstDebateTurn(history)
        if (useSummary && !isFirstTurn && !skipSummaryOnce) {
          const prevSummary = summaryRef.current
          const participantCount = parts.length
          const nonTopicMsgs = history.filter(message => message.role !== 'topic')
          const forSummary = nonTopicMsgs.slice(-participantCount)
          const moderatorTags = new Set(parts.filter(participant => participant.isModerator).map(participant => participant.tag))
          const moderatorInterventionThisRound = forSummary.some(message => {
            if (!moderatorTags.has(message.role)) return false
            const content = String(message.content || '').trim()
            if (!content) return false
            return Debate.isModerationDirectiveStyle(content)
          })
          const toSummarize = forSummary.map(message => {
            if (message.role === 'user') return `[Moderator intervention]: ${message.content}`
            if (message.role === 'interjection') return `[Topic variation]: ${message.content}`
            const participant = parts.find(entry => entry.tag === message.role)
            const label = participant ? (participant.name || participant.tag) : message.role
            return `${label}: ${message.content}`
          }).join('\n\n')

          const topicDrift = Debate.detectTopicDrift({ history, messages: forSummary })
          const unsupportedAssumptions = Debate.detectUnsupportedAssumptionDrift({ messages: forSummary })
          if (topicDrift.detected || unsupportedAssumptions.detected) {
            roundModerationSignal = {
              needed: true,
              reason: [topicDrift.reason, unsupportedAssumptions.reason].filter(Boolean).join(' | '),
            }
          }

          const summaryModel = Debate.pickOperationalModel(parts, summaryModelEnabled, summaryModelOverride)
          const summarySystem = Debate.buildRoundSummarySystemPrompt(uiLang, LANGUAGES)
          const debugPayloads = []
          const debugCalls = []

          const summaryCall = async (prompt, payloadsOut, kind = 'summary') => {
            const result = await streamChat({
              baseUrl,
              model: summaryModel,
              messages: [{ ollamaRole: 'user', content: prompt }],
              systemPrompt: summarySystem,
              useTools: false,
              onToken: () => {},
              onEstimate: handlePromptEstimate,
              onPayload: debugMode ? (payload => payloadsOut.push(payload)) : null,
              timeoutMs,
            })
            if (debugMode) debugCalls.push({ kind, prompt, response: result })
            return result
          }

          setSummaryInProgress(true)
          try {
            const combinedPrompt = Debate.buildRoundSummaryPrompt({
              parts,
              prevSummary,
              summaryAccumulate,
              summaryAccumulateThreshold,
              moderatorInterventionThisRound,
              toSummarize,
            })
            const combinedRaw = await summaryCall(combinedPrompt, debugPayloads, 'summary+affinity')
            const bundle = Debate.parseSummaryAffinityBundle(combinedRaw)
            if (!bundle) throw new Error('Invalid summary/affinity JSON payload')
            const modelModerationSignal = bundle.moderation || { needed: false, reason: '' }
            roundModerationSignal = {
              needed: !!(roundModerationSignal?.needed || modelModerationSignal.needed),
              reason: [roundModerationSignal?.reason || '', modelModerationSignal.reason || ''].filter(Boolean).join(' | '),
            }

            const trimmed = bundle.summary.trim()
            summaryRef.current = trimmed
            setSummary(trimmed)

            if (dynamicAffinity && parts.length > 1) {
              const affinityUpdate = Debate.applyDynamicAffinityUpdates({
                participants: parts,
                deltas: bundle.deltas,
                moderatorIntervention: moderatorInterventionThisRound,
                moderationCooling,
              })

              if (affinityUpdate.changed) {
                parts = affinityUpdate.participants
                participantsRef.current = affinityUpdate.participants
                setParticipants(affinityUpdate.participants)
              }
            }

            if (debugMode && debugPayloads.length) {
              let affinityDebug = null
              for (let index = debugCalls.length - 1; index >= 0; index -= 1) {
                if (debugCalls[index].kind === 'affinity') { affinityDebug = debugCalls[index]; break }
              }
              setSummaryDebug({ payload: debugPayloads[debugPayloads.length - 1], debugPayloads, debugCalls, affinityDebug })
            }
          } catch (err) {
            console.warn('[summary] fallita:', err.message)
          } finally {
            setSummaryInProgress(false)
          }
        }
        skipSummaryOnce = false
      }

      for (let s = step; s < parts.length; s += 1) {
        step = 0
        if (stopRef.current) break outer

        parts = participantsRef.current
        if (s >= parts.length) break

        const actor = parts[s]
        const actorBaseUrl = actor.endpointOverride?.trim() || baseUrl
        const turnLabel = round + 1

        const lifecycleMessages = Debate.buildParticipantLifecycleMessages({
          history,
          participants: parts,
          actor,
          turn: turnLabel,
          nextSeq,
        })
        if (lifecycleMessages.length > 0) {
          history = [...history, ...lifecycleMessages]
          setMessages([...history])
        }

        const realHistory = history

        if (actor.isModerator) {
          const moderationDecision = Debate.shouldModeratorIntervene({
            actor,
            history: realHistory,
            participants: parts,
            roundModerationSignal,
          })
          if (!moderationDecision.shouldIntervene) continue
        }

        if (actor.model !== Debate.USER_MODEL) {
          const seq = nextSeq()
          const placeholder = { role: actor.tag, ollamaRole: 'assistant', content: '', turn: turnLabel, seq, participantSnapshot: { ...actor } }
          history = [...history, placeholder]
          setMessages([...history])
          setStreamingSeq(seq)
        }
        setStreamingRole(actor.tag)

        const nextStep = s + 1 < parts.length ? s + 1 : 0
        const nextRound = s + 1 < parts.length ? round : round + 1
        turnRef.current = { round: nextRound, step: nextStep }

        if (stopRef.current) {
          history = history.slice(0, -1)
          setMessages([...history])
          break outer
        }

        const contextMessages = []
        const injectedUrls = new Set()
        const urlContextBlocks = []

        if (!fetchedUrlsRef.current[actor.id]) fetchedUrlsRef.current[actor.id] = new Set()
        const actorFetchedUrls = fetchedUrlsRef.current[actor.id]

        const injectUrlsFrom = async content => {
          const urls = Web.extractUrls(content)
          for (const url of urls) {
            if (injectedUrls.has(url)) continue
            injectedUrls.add(url)
            if (actorFetchedUrls.has(url)) continue
            actorFetchedUrls.add(url)
            const summary = await Web.fetchAndSummarizePage(url, {
              summarizePage: async raw => {
                let summary = ''
                await streamChat({
                  baseUrl: actorBaseUrl,
                  model: actor.model,
                  messages: [{ ollamaRole: 'user', content: `Summarize the following article in a concise, neutral and informative way (150-250 words). Focus on key facts, claims, and context. Do not editorialize.\n\nArticle content:\n${raw}` }],
                  systemPrompt: 'You are a precise summarization assistant. Output only the summary, no preamble.',
                  useTools: false,
                  onToken: token => { summary = token },
                  timeoutMs,
                })
                return summary
              },
            })
            if (summary) urlContextBlocks.push(`### ${url}\n${summary}`)
          }
        }

        const pushMsg = async (ollamaRole, content) => {
          contextMessages.push({ ollamaRole, content })
          await injectUrlsFrom(content)
        }

        const pushHistoryMsg = async message => {
          if (message.role === 'topic') {
            await injectUrlsFrom(message.content)
          } else if (message.role === 'participant_joined' || message.role === 'participant_left') {
            return
          } else if (message.role === 'user') {
            await pushMsg('user', `[Moderator]: ${message.content}`)
          } else if (message.role === 'interjection') {
            await injectUrlsFrom(message.content)
          } else if (message.role === actor.tag) {
            if (message.content && message.content.trim().startsWith('<function_calls>')) return
            contextMessages.push({ ollamaRole: 'assistant', content: message.content })
          } else {
            if (message.content && message.content.trim().startsWith('<function_calls>')) return
            const other = parts.find(participant => participant.tag === message.role)
            const otherName = other?.name || other?.tag || message.role
            contextMessages.push({ ollamaRole: 'user', content: `${otherName} said: ${message.content}` })
          }
        }

        if (!useSummary) {
          for (const message of realHistory) await pushHistoryMsg(message)
        } else if (summaryRef.current) {
          contextMessages.push({ ollamaRole: 'user', content: `[Conversation summary so far]\n${summaryRef.current}` })
          const currentRoundMsgs = realHistory.filter(message => message.role === 'topic' || message.role === 'interjection' || message.turn === round + 1)
          for (const message of currentRoundMsgs) await pushHistoryMsg(message)
        } else {
          for (const message of realHistory) await pushHistoryMsg(message)
        }

        const sourceUrls = [...new Set(
          realHistory
            .filter(message => message.role === 'topic' || message.role === 'interjection')
            .flatMap(message => Web.extractUrls(message.content))
        )]

        if (actor.characterType && actor.name && characterContextRef.current[actor.id] === undefined) {
          characterContextRef.current[actor.id] = null
          const ctx = await Debate.resolveCharacterContext({ actor, baseUrl: actorBaseUrl, timeoutMs, onEstimate: handlePromptEstimate })
          characterContextRef.current[actor.id] = ctx
        }
        const characterContext = characterContextRef.current[actor.id] ?? null
        let systemPrompt = buildSystemPrompt({
          actor,
          allParticipants: parts,
          history: history.slice(0, -1),
          externalModerationTrigger: actor.isModerator
            ? {
                needed: !!roundModerationSignal?.needed,
                reason: roundModerationSignal?.reason || '',
              }
            : null,
          characterContext,
          uiLang,
          attachedDocs: docsForPrompt,
          globalConstraints,
          generalPersonalityInstructions,
          constants: Debate.buildPromptConstants(),
        })
        if (urlContextBlocks.length > 0) {
          systemPrompt += `\n\n## Context files\nThe following articles have already been fetched for you. Do not search for them again.\n\n${urlContextBlocks.join('\n\n')}`
        }

        if (actor.model === Debate.USER_MODEL) {
          try {
            const userText = await new Promise((resolve, reject) => {
              userInputRejectRef.current = reject
              setUserInputPending({ resolve, tag: actor.tag })
            })
            userInputRejectRef.current = null
            if (userText !== null) {
              const userMsg = { role: actor.tag, ollamaRole: 'assistant', content: userText, turn: turnLabel, seq: nextSeq(), participantSnapshot: { ...actor } }
              history = [...history, userMsg]
              setMessages([...history])
            }
          } catch {
            userInputRejectRef.current = null
          }
          setUserInputPending(null)
          setStreamingRole(null)
          setStreamingSeq(null)
          continue
        }

        try {
          const debugPayloads = []
          const payload = { model: actor.model, systemPrompt, messages: contextMessages }
          const full = await streamChat({
            baseUrl: actorBaseUrl,
            model: actor.model,
            messages: contextMessages,
            systemPrompt,
            useTools: true,
            sourceUrls,
            onEstimate: handlePromptEstimate,
            onPayload: debugMode ? (p => debugPayloads.push(p)) : null,
            onToken: text => {
              history = history.map((message, index) => index === history.length - 1 ? { ...message, content: text } : message)
              setMessages([...history])
            },
            timeoutMs,
          })
          const finalContent = full && full.trim() ? full : (history[history.length - 1]?.content ?? '')
          const shouldSkipModeratorTurn = actor.isModerator && !actor.moderatorAlwaysIntervene && !roundModerationSignal?.needed && /^\s*\[SKIP_TURN\]\s*$/i.test(finalContent)
          if (shouldSkipModeratorTurn) {
            history = history.slice(0, -1)
            setMessages([...history])
            setStreamingRole(null)
            setStreamingSeq(null)
            continue
          }
          let moderatedContent = finalContent
          if (actor.isModerator && finalContent.trim() && !Debate.isModerationDirectiveStyle(finalContent)) {
            let rewrite = ''
            try {
              await streamChat({
                baseUrl: actorBaseUrl,
                model: actor.model,
                useTools: false,
                timeoutMs,
                onEstimate: handlePromptEstimate,
                systemPrompt: `You are a strict process moderator. Do not summarize positions. Output only operational moderation in ${Debate.buildLanguageLabel(uiLang, LANGUAGES)} (language code: ${uiLang}).`,
                messages: [{
                  ollamaRole: 'user',
                  content: `Rewrite this moderator draft as a REAL moderation intervention (not a recap, not a synthesis).\n\nDraft:\n${finalContent}\n\nOutput format (mandatory, 3 short lines, in the user's language):\n1) <brief reason for intervention now>\n2) <directive: what must change immediately>\n3) <next turn: who should answer and with what focus>\n\nUse labels naturally in that language. Avoid the word "trigger".\nMax 5 total sentences. No preamble.`,
                }],
                onToken: token => { rewrite = token },
              })
              if (rewrite.trim() && Debate.isModerationDirectiveStyle(rewrite)) {
                moderatedContent = rewrite.trim()
              }
            } catch {
              // fallback: keep original output
            }
          }
          if (moderatedContent.trim()) {
            history = history.map((message, index) => index === history.length - 1 ? { ...message, content: moderatedContent, ...(debugMode ? { payload, debugPayloads } : {}) } : message)
          } else {
            history = history.slice(0, -1)
          }
          setMessages([...history])
        } catch (err) {
          const errMsg = {
            role: 'error',
            ollamaRole: null,
            content: `⚠ ${err.message} — use the Resume button to retry from this point.`,
            turn: turnLabel,
            seq: nextSeq(),
          }
          history = [...history.slice(0, -1), errMsg]
          setMessages([...history])
          turnRef.current = { round, step: s, skipSummary: true }
          setStreamingRole(null)
          setStreamingSeq(null)
          setStopping(false)
          setRunning(false)
          return
        }

        const interjection = interjectRef.current
        if (interjection) {
          interjectRef.current = null
          const userMsg = { role: 'interjection', ollamaRole: 'user', content: interjection, turn: turnLabel + 0.5, seq: nextSeq() }
          history = [...history.filter(message => !(message.pending && message.role === 'interjection' && message.content === interjection)), userMsg]
          setMessages([...history])
        }

        setStreamingRole(null)
        setStreamingSeq(null)
      }

      Debate.updateConclusionConv(history, parts, conclusionConvRef)
      round += 1
      step = 0
      turnRef.current = { round, step: 0 }
    }

    setStreamingRole(null)
    setStreamingSeq(null)
    setStopping(false)
    setRunning(false)
  }
}
