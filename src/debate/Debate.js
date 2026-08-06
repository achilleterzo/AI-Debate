import { RANDOM_NAMES } from '../dataset/RandomNames'
import { UI_LANGUAGE_OPTIONS as LANGUAGES } from '../i18n/UiStrings'
import { PALETTE } from '../dataset/Palette'
import { Session } from '../data/Session'
import { buildSystemPrompt } from './PromptBuilder'
import { streamChat } from './Stream'
import { Web } from '../services/Web'
import { MOODS } from '../prompts/Moods'
import { MOOD_INTENSITY } from '../prompts/MoodIntensity'
import { DEFAULT_RESPONSE_LENGTH, RESPONSE_LENGTHS } from '../prompts/ResponseLengths'
import { EDUCATION_LEVELS } from '../prompts/EducationLevels'
import { AGE_GROUPS } from '../prompts/AgeGroups'
import { CHARACTER_TYPES } from '../dataset/CharacterTypes'
import { outputLanguageLabel, outputLanguagePhrase } from '../prompts/LanguagePrompt'
import { DEFAULT_DEBATE_MODE, DEBATE_MODES, DEBATE_MODE_CONCLUSION_INSTRUCTIONS, normalizeDebateMode } from '../prompts/Modes'
import { DEFAULT_MODERATOR_FACILITATION_INTERVAL as DEFAULT_FACILITATION_INTERVAL, DEFAULT_MODERATOR_PERMISSIVENESS as DEFAULT_PERMISSIVENESS, normalizeModeratorFacilitationInterval, normalizeModeratorPermissiveness } from '../settings/Settings'
import { createConversationToolExecutor, formatDiceRoll, LLM_TOOLS, LLM_TOOLS_WITHOUT_MODERATOR_INTERVENTION, MEMORY_MAX_CONTENT_CHARS, MEMORY_MAX_ENTRIES, MODERATOR_TOOLS, ROLE_PLAY_TOOLS, ROLE_PLAY_TOOLS_WITHOUT_MODERATOR_INTERVENTION, readMemory, rollDice } from '../tools'

function normalizeForDuplicateCheck(text) {
  return String(text || '').replace(/\s+/g, ' ').trim()
}

function continuationOverlap(previous, current) {
  const left = normalizeForDuplicateCheck(previous)
  const right = normalizeForDuplicateCheck(current)
  if (!left || !right) return 0
  const max = Math.min(left.length, right.length)
  for (let length = max; length >= 20; length -= 1) {
    if (left.slice(-length) === right.slice(0, length)) return length
  }
  return 0
}

function carryToolInvocations(history, fromSeq, toSeq) {
  const source = history.find(message => message.seq === fromSeq)
  if (!source?.toolInvocations?.length && !source?.toolEvents?.length) return history
  return history.map(message => message.seq === toSeq
    ? {
        ...message,
        ...(source.toolInvocations?.length
          ? { toolInvocations: [...(message.toolInvocations || []), ...source.toolInvocations] }
          : {}),
        ...(source.toolEvents?.length
          ? { toolEvents: [...(message.toolEvents || []), ...source.toolEvents] }
          : {}),
      }
    : message)
}

function reconcileToolContinuation(history, previousSeq, currentSeq, currentContent) {
  const previousIndex = history.findIndex(message => message.seq === previousSeq)
  const currentIndex = history.findIndex(message => message.seq === currentSeq)
  if (previousIndex < 0 || currentIndex < 0) return { history, activeSeq: currentSeq, content: currentContent }

  const previousContent = history[previousIndex].content || ''
  const previous = normalizeForDuplicateCheck(previousContent)
  const current = normalizeForDuplicateCheck(currentContent)
  if (!current) return { history, activeSeq: currentSeq, content: currentContent }

  // A provider is allowed to emit the tool call before any visible text.
  // In that case the first message is an empty anchor carrying the tool
  // invocation, while the next assistant segment contains the actual answer.
  // Merge that answer back into the anchor instead of leaving an empty
  // message behind and relying on the timeline to infer the relationship.
  if (!previous) {
    const historyWithTools = carryToolInvocations(history, currentSeq, previousSeq)
    return {
      history: historyWithTools
        .map(message => message.seq === previousSeq ? { ...message, content: currentContent } : message)
        .filter(message => message.seq !== currentSeq),
      activeSeq: previousSeq,
      content: currentContent,
    }
  }

  // A repeated or shorter continuation contains no new information.
  if (current === previous || previous.includes(current)) {
    const historyWithTools = carryToolInvocations(history, currentSeq, previousSeq)
    return {
      history: historyWithTools.filter(message => message.seq !== currentSeq),
      activeSeq: previousSeq,
      content: previousContent,
    }
  }

  // If the model repeats the previous segment and then continues, keep the
  // complete union in the first message instead of showing a fragile suffix.
  if (current.startsWith(previous)) {
    const merged = currentContent.trim()
    const historyWithTools = carryToolInvocations(history, currentSeq, previousSeq)
    return {
      history: historyWithTools
        .map(message => message.seq === previousSeq ? { ...message, content: merged } : message)
        .filter(message => message.seq !== currentSeq),
      activeSeq: previousSeq,
      content: merged,
    }
  }

  // Also remove only a substantial suffix/prefix overlap; short common words
  // are deliberately not treated as duplication.
  const overlap = continuationOverlap(previousContent, currentContent)
  if (overlap > 0) {
    const merged = `${previousContent.trim()} ${currentContent.trim().slice(overlap).trimStart()}`.trim()
    const historyWithTools = carryToolInvocations(history, currentSeq, previousSeq)
    return {
      history: historyWithTools
        .map(message => message.seq === previousSeq ? { ...message, content: merged } : message)
        .filter(message => message.seq !== currentSeq),
      activeSeq: previousSeq,
      content: merged,
    }
  }

  return { history, activeSeq: currentSeq, content: currentContent }
}

export class Debate {
  static CONCLUSION_CONVERSATION_LIMIT = 8000

  static CONCLUSION_MESSAGE_LIMIT = 600

  static CONCLUSION_ATTACHMENT_LIMIT = 2200

  static DOCUMENT_SUMMARY_WORD_LIMIT = 450

  static DEFAULT_MOOD = 'diplomatic'

  static USER_MODEL = '__user__'

  // Floor for the recent context window, so a two-participant debate still
  // carries enough back-and-forth to answer coherently.
  static RECENT_CONTEXT_MIN_MESSAGES = 6

  static REASONING_LANG_CUSTOM = '__custom__'

  static THINKING_LEVELS = ['none', 'low', 'medium', 'high', 'max']

  static DEFAULT_THINKING_LEVEL = 'none'

  static MODERATOR_MODES = ['containment', 'facilitator', 'active']

  static DEFAULT_MODERATOR_MODE = 'containment'

  static DEFAULT_MODERATOR_PERMISSIVENESS = DEFAULT_PERMISSIVENESS

  static DEFAULT_MODERATOR_FACILITATION_INTERVAL = DEFAULT_FACILITATION_INTERVAL

  // Migrates the legacy moderatorAlwaysIntervene boolean into the mode select.
  static normalizeModeratorMode(participant) {
    const mode = participant?.moderatorMode
    if (Debate.MODERATOR_MODES.includes(mode)) return mode
    return participant?.moderatorAlwaysIntervene ? 'active' : Debate.DEFAULT_MODERATOR_MODE
  }

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
      localUser: false,
      endpointOverride: '',
      name: '',
      isModerator: false,
      moderatorMode: Debate.DEFAULT_MODERATOR_MODE,
      moderatorPermissiveness: Debate.DEFAULT_MODERATOR_PERMISSIVENESS,
      moderatorFacilitationInterval: Debate.DEFAULT_MODERATOR_FACILITATION_INTERVAL,
      moderatorDynamicAffinity: false,
      moderatorFactCheck: false,
      moderatorEnforceTopic: false,
      mood: Debate.DEFAULT_MOOD,
      moodIntensity: Debate.DEFAULT_MOOD_INTENSITY,
      reasoningLang: '',
      reasoningLangCustom: '',
      reasoningLangSkipTranslation: false,
      thinkingLevel: Debate.DEFAULT_THINKING_LEVEL,
      affinity: {},
      affinityLocks: {},
      characterType: null,
      responseLength: DEFAULT_RESPONSE_LENGTH,
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

  // Constraints are stored as { text, override } objects; plain strings are
  // accepted for backward compatibility with older snapshots and settings.
  static normalizeParticipantConstraints(raw) {
    if (!Array.isArray(raw)) return []
    return raw
      .map(entry => typeof entry === 'string'
        ? { text: entry, override: false }
        : { text: String(entry?.text ?? ''), override: !!entry?.override })
      .filter(entry => entry.text.trim())
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
             targets: Debate.normalizeModerationTargets(parsed.moderation.targets ?? parsed.moderation.target),
           }
         : { needed: false, reason: '', targets: [] }

      if (!summary) return null
      return { summary, deltas, moderation }
    } catch {
      return null
    }
  }

  static getActiveTopicMessage(history = []) {
    return [...history].reverse().find(message => (message.role === 'interjection' || message.role === 'topic') && message.content?.trim()) || null
  }

  static normalizeModerationTargets(raw) {
    const values = Array.isArray(raw) ? raw : raw ? [raw] : []
    return [...new Set(values.map(value => String(value || '').trim()).filter(Boolean))]
  }

  /**
   * Caps the assembled context to a character budget, always applied whether
   * or not a summary is running: without one it is the only thing keeping the
   * payload bounded. The newest exchanges are kept, since they carry the turn
   * the participant has to answer; the last message always survives.
   */
  static capContextMessages(messages = [], maxChars = 0) {
    if (!Array.isArray(messages) || messages.length === 0) return []
    if (!Number.isFinite(maxChars) || maxChars <= 0) return [...messages]

    const kept = []
    let total = 0
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const size = String(messages[index]?.content ?? '').length
      if (kept.length > 0 && total + size > maxChars) break
      kept.unshift(messages[index])
      total += size
    }
    return kept
  }

  /**
   * Recent window handed to a participant when a summary already covers the
   * older part of the debate.
   *
   * Sized on the roster, not on the actor's own last turn: with a per-actor
   * window whoever had just spoken saw almost nothing, while whoever had been
   * silent for a while dragged in a large slice of the debate — so the payload
   * differed wildly from one participant to the next. One slot per participant
   * keeps roughly a full round in view for everybody, and the floor stops a
   * two-person debate from shrinking to a couple of lines.
   */
  static getRecentContext(history = [], participantCount = 0) {
    const count = Number.isFinite(participantCount) ? Math.floor(participantCount) : 0
    const size = Math.max(Debate.RECENT_CONTEXT_MIN_MESSAGES, count)
    return history
      .filter(message => !['error', 'participant_joined', 'participant_left'].includes(message.role))
      .slice(-size)
  }

  static appendInterjection(history = [], interjection) {
    if (!interjection?.content?.trim()) return history
    const exists = history.some(message => message.role === 'interjection' && message.seq === interjection.seq)
    if (exists) return history
    return [...history, { ...interjection, pending: false }]
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
      DEFAULT_THINKING_LEVEL: Debate.DEFAULT_THINKING_LEVEL,
      normalizeAffinity: Debate.normalizeAffinity,
      normalizeAffinityLocks: Debate.normalizeAffinityLocks,
      normalizeConstraints: Debate.normalizeParticipantConstraints,
      normalizeModeratorMode: Debate.normalizeModeratorMode,
      normalizeModeratorPermissiveness,
      normalizeModeratorFacilitationInterval,
      normalizeThinkingLevel: Debate.normalizeThinkingLevel,
    }
  }

  static hydrateParticipantsFromSession(participants = []) {
    return participants.map((participant, index) => Session.hydrateParticipant(participant, index, Debate.sessionConstants()))
  }

  static serializeParticipantsForSession(participants = []) {
    return participants.map(participant => Session.serializeParticipant(participant, Debate.sessionConstants()))
  }

  /**
   * A generated persona as a brand-new participant.
   *
   * Unlike applying a draft to an existing row there is nothing to preserve:
   * the traits become the constraints and everything the draft leaves out
   * keeps its default, so an incomplete answer degrades into a plain
   * participant instead of a broken one.
   */
  static participantFromDraft(idx, draft = {}, { characterType = null, isModerator = false } = {}) {
    const base = Debate.mkParticipant(idx, '')
    return {
      ...base,
      name: draft.name || base.name,
      characterType,
      isModerator,
      constraints: (draft.traits ?? []).map(trait => ({ text: trait, override: false })),
      ...(draft.ageGroup != null ? { ageGroup: draft.ageGroup } : {}),
      ...(draft.educationLevel ? { educationLevel: draft.educationLevel } : {}),
      ...(draft.mood ? { mood: draft.mood } : {}),
      ...(draft.moodIntensity != null ? { moodIntensity: draft.moodIntensity } : {}),
      ...(Object.prototype.hasOwnProperty.call(draft, 'responseLength') ? { responseLength: draft.responseLength } : {}),
      ...(draft.reasoningLang ? { reasoningLang: draft.reasoningLang } : {}),
    }
  }

  static reindexParticipants(participants = []) {
    return participants.map((participant, index) => ({
      ...Debate.mkParticipant(index, participant.model),
      endpointOverride: participant.endpointOverride ?? '',
      name: participant.name,
      isModerator: !!participant.isModerator || participant.mood === 'moderator',
      moderatorMode: Debate.normalizeModeratorMode(participant),
      moderatorPermissiveness: normalizeModeratorPermissiveness(participant.moderatorPermissiveness),
      moderatorFacilitationInterval: normalizeModeratorFacilitationInterval(participant.moderatorFacilitationInterval),
      moderatorDynamicAffinity: !!participant.moderatorDynamicAffinity,
      moderatorEnforceTopic: !!participant.moderatorEnforceTopic,
      moderatorFactCheck: !!participant.moderatorFactCheck,
      mood: participant.mood,
      moodIntensity: participant.moodIntensity ?? Debate.DEFAULT_MOOD_INTENSITY,
      reasoningLang: participant.reasoningLang ?? '',
      reasoningLangCustom: participant.reasoningLangCustom ?? '',
      reasoningLangSkipTranslation: !!participant.reasoningLangSkipTranslation,
      thinkingLevel: Debate.normalizeThinkingLevel(participant.thinkingLevel),
      localUser: !!participant.localUser || participant.model === Debate.USER_MODEL,
      characterType: participant.characterType ?? null,
      responseLength: participant.responseLength === undefined ? DEFAULT_RESPONSE_LENGTH : participant.responseLength,
      educationLevel: participant.educationLevel ?? Debate.DEFAULT_EDUCATION_LEVEL,
      ageGroup: participant.ageGroup ?? Debate.DEFAULT_AGE_GROUP,
      affinity: Debate.normalizeAffinity(participant.affinity),
      affinityLocks: Debate.normalizeAffinityLocks(participant.affinityLocks),
      constraints: Debate.normalizeParticipantConstraints(participant.constraints),
      characterContext: participant.characterContext ?? null,
    }))
  }

  /**
   * Speaking order for one round, as participant ids.
   *
   * Every moderator keeps its own slot: its turn is procedural — it opens,
   * closes or polices the round — so moving it would change *when* moderation
   * lands, not just who speaks first. Only the other participants are shuffled,
   * among the positions the moderators leave free.
   *
   * `lastSpeakerId` is who closed the previous round: the shuffle never hands
   * them the opening slot, because speaking twice in a row makes them answer
   * themselves across the round boundary.
   */
  static buildRoundOrder(participants = [], { randomize = false, random = Math.random, lastSpeakerId = null } = {}) {
    const ids = participants.map(participant => participant.id)
    if (!randomize || ids.length < 2) return ids

    const movable = participants.filter(participant => !participant.isModerator).map(participant => participant.id)
    for (let index = movable.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(random() * (index + 1))
      const current = movable[index]
      movable[index] = movable[swap]
      movable[swap] = current
    }

    // Only worth correcting when the opening slot is one of the shuffled ones:
    // a moderator opening the round holds a fixed position by design.
    const opensTheRound = !participants[0]?.isModerator
    if (opensTheRound && lastSpeakerId != null && movable.length > 1 && movable[0] === lastSpeakerId) {
      const swap = 1 + Math.floor(random() * (movable.length - 1))
      movable[0] = movable[swap]
      movable[swap] = lastSpeakerId
    }

    let cursor = 0
    return participants.map(participant => participant.isModerator ? participant.id : movable[cursor++])
  }

  static reorderParticipants(participants = [], fromIndex, toIndex) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= participants.length || toIndex >= participants.length) {
      return participants
    }

    const reordered = [...participants]
    const [moved] = reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, moved)
    return reordered
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
    debateMode = DEFAULT_DEBATE_MODE,
  }) {
    const selectedMode = DEBATE_MODES.find(mode => mode.id === normalizeDebateMode(debateMode)) ?? DEBATE_MODES[0]
    const docsForConclusion = Debate.buildConclusionAttachments(attachedDocs)
    return {
      debate_mode: selectedMode.id,
      debate_mode_label: selectedMode.labelEn,
      debate_mode_instruction: selectedMode.instruction || '',
      debate_mode_conclusion_instruction: DEBATE_MODE_CONCLUSION_INSTRUCTIONS[selectedMode.id] || DEBATE_MODE_CONCLUSION_INSTRUCTIONS[DEFAULT_DEBATE_MODE],
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
    const modeGuidance = context.debate_mode_conclusion_instruction
      ? `Shared debate mode (HIGH PRIORITY): ${context.debate_mode_label || context.debate_mode || DEFAULT_DEBATE_MODE}. ${context.debate_mode_conclusion_instruction}`
      : ''
    const additionalGuidance = conclusionType.id !== 'custom' && standardPrompt
      ? `Additional guidance (HIGH PRIORITY):\n${standardPrompt}\n\nThis guidance must strongly steer the output to better match the target objective for this conclusion type.`
      : ''
    return [baseConclusionPrompt, modeGuidance, additionalGuidance].filter(Boolean).join('\n\n')
  }

  static normalizeThinkingLevel(value) {
    return Debate.THINKING_LEVELS.includes(value) ? value : Debate.DEFAULT_THINKING_LEVEL
  }

  static shouldRewriteConclusionResult(result, uiLang) {
    const leakedReasoning = /\b(the user is asking|let me analyze|i need to|now i need to|here'?s my analysis)\b/i.test(result)
    const wrongLangHint = uiLang === 'it' && /\b(the|and|therefore|however|considerations|contradictions|blindspots|next steps)\b/i.test(result.slice(0, 600))
    return !!result && (leakedReasoning || wrongLangHint)
  }

  /**
   * Model used for side work: summaries, conclusions and suggestions.
   *
   * The dedicated model wins when set, then the default model. Falling back to
   * a participant's model last matters because participants may now follow the
   * default and carry no model of their own, which used to resolve to an empty
   * string and silently skip the summary altogether.
   */
  static pickOperationalModel(parts = [], overrideValue = '', defaultModel = '') {
    if (overrideValue) return overrideValue
    if (defaultModel) return defaultModel
    return parts.find(participant => participant.model && !participant.localUser && participant.model !== Debate.USER_MODEL)?.model ?? ''
  }

  static hasConfiguredModel(participant, defaultModel = '') {
    return Boolean(participant?.localUser || participant?.model === Debate.USER_MODEL || participant?.model || defaultModel)
  }

  static buildLanguageLabel(uiLang, languages = []) {
    return outputLanguageLabel(uiLang, languages)
  }

  static buildDocumentSummarySystemPrompt(uiLang, languages = []) {
    return `You are a precise analytical summarizer. Output only the requested summary, no preamble. Write in ${outputLanguagePhrase(uiLang, languages)}.`
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
      const topicMsg = { role: 'topic', content: injectTopic ?? '', turn: 0, seq: nextSeq() }
      return { history: [topicMsg], round: 0, step: 0, seededMessages: [topicMsg] }
    }

    if (injectTopic) {
      const userMsg = { role: 'interjection', content: injectTopic, turn: round, seq: nextSeq() }
      const nextHistory = [...history, userMsg]
      return { history: nextHistory, round, step: null, seededMessages: nextHistory }
    }

    return { history, round, step: null, seededMessages: null }
  }

  static isFirstDebateTurn(history = []) {
    return history.filter(message => !['topic', 'interjection', 'participant_joined', 'participant_left', 'error'].includes(message.role)).length === 0
  }

  static buildRoundSummarySystemPrompt(uiLang, languages = []) {
    return `You are a concise summarizer. Output only the requested summary text, no preamble, no commentary, no tool calls, no markdown headings. Write in ${outputLanguagePhrase(uiLang, languages)}.`
  }

  static buildRoundSummaryPrompt({
    parts = [],
    prevSummary = '',
    summaryAccumulateThreshold = 8,
    moderatorInterventionThisRound = false,
    toSummarize = '',
  }) {
    const participantsList = parts.map(participant => `${participant.tag}: ${participant.name || participant.tag}`).join('\n')
    const moderator = parts.find(participant => participant.isModerator)
    const permissiveness = normalizeModeratorPermissiveness(moderator?.moderatorPermissiveness)
    const thresholdBytes = summaryAccumulateThreshold * 1024
    const summaryMode = prevSummary
      ? `ACCUMULATE mode is ON. If previous_summary exceeds ${thresholdBytes} characters, compact it first, then append only a concise paragraph for new exchanges. Otherwise append directly.`
      : 'STANDARD mode: produce an updated concise summary including new exchanges.'

    return `Return ONLY strict JSON (no markdown, no prose) with exact shape:\n{\n  "summary": "<updated summary text>",\n  "affinity_deltas": { "A": { "B": -0.20 }, "B": { "A": 0.15 } },\n  "moderation": { "needed": false, "reason": "", "targets": [] }\n}\n\nRules for affinity_deltas:\n- keys are participant TAGS only\n- values are round deltas in [-1.00, +1.00]\n- use meaningful magnitudes: ±0.10 is a weak signal, ±0.25 is noticeable, ±0.50 is strong, and ±0.75 or more is exceptional\n- represent genuine agreement with positive deltas as readily as disagreement with negative deltas; do not systematically keep positive affinity near zero\n- use 0 or omit when there is no meaningful change\n- no self links\n- do not invent tags\n${moderatorInterventionThisRound ? '- A moderator intervened in this round: bias deltas toward de-escalation (reduce absolute affinity values unless strong evidence suggests otherwise).' : ''}\n\nRules for moderation:\n- Set moderation.needed=true only when moderation is concretely needed now (personal attacks, escalation, severe off-topic drift, unsupported speculation presented as fact, or explicit request for moderation).\n- Moderator permissiveness level is ${permissiveness}/4, where 0 is very relaxed and 4 is very strict. Always flag explicit personal abuse; at higher levels also flag hostile personal framing and escalating taunts.\n- targets must contain the participant TAGS who should receive the corrective intervention; use [] when moderation is not needed or is only facilitation.\n- Keep reason short and specific.\n\nSummary policy:\n${summaryMode}\n\nParticipants:\n${participantsList}\n\nPrevious summary:\n${prevSummary || '(none)'}\n\nNew exchanges in current round:\n${toSummarize}`
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
      REASONING_LANG_CUSTOM: Debate.REASONING_LANG_CUSTOM,
      DEBATE_MODES,
      DEFAULT_DEBATE_MODE,
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
        messages: [{ role: 'user', content: userMsg }],
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

  static getDirectPersonalAttackTargets(history = [], participants = [], moderatorTag = '', permissiveness = Debate.DEFAULT_MODERATOR_PERMISSIVENESS) {
    const participantTags = new Set(participants.filter(participant => !participant.isModerator).map(participant => String(participant.tag || '').toLowerCase()).filter(Boolean))
    const participantNames = participants
      .filter(participant => !participant.isModerator && participant.name)
      .map(participant => participant.name.trim().toLowerCase())
    const level = normalizeModeratorPermissiveness(permissiveness)
    const attackPatterns = [
      { minLevel: 0, pattern: /\b(?:sei|siete|è|sono)\s+(?:un[ao]?\s+)?(?:idiot[aoie]|stupid[aoie]|patetic[aoie]|ignorant[ei]|disgustos[aoie]|incompetent[ei])\b/i },
      { minLevel: 0, pattern: /\b(?:you(?:'re| are)|he'?s|she'?s)\s+(?:an?\s+)?(?:idiot|stupid|pathetic|ignorant|disgusting|incompetent)\b/i },
      { minLevel: 0, pattern: /\b(?:fate schifo|shut up)\b/i },
      { minLevel: 1, pattern: /\b(?:ridicol[aoie]|ridiculous)\b/i },
      { minLevel: 2, pattern: /\b(?:smettila|smettetela|basta con|supercazzola|disco rotto|ma sei serio|are you serious)\b/i },
      { minLevel: 3, pattern: /\b(?:non hai idea|non avete idea|state solo cercando|you have no idea|you are just)\b/i },
      { minLevel: 4, pattern: /\b(?:smetti|smettiamola|ma quale|what are you talking about)\b/i },
    ]

    const lastModeratorIndex = moderatorTag
      ? history.map(message => message.role).lastIndexOf(moderatorTag)
      : -1
    const pendingMessages = history.slice(lastModeratorIndex + 1)

    return [...new Set(pendingMessages.flatMap(message => {
      if (!message.content || !participantTags.has(String(message.role || '').toLowerCase())) return []
      const text = String(message.content).trim()
      if (!text) return []
      const mentionsParticipant = [...participantTags, ...participantNames].some(label => {
        if (!label) return false
        return new RegExp(`\\b${Debate.escapeRegExp(label)}\\b`, 'i').test(text)
      })
      const matched = attackPatterns.some(({ minLevel, pattern }) => minLevel <= level && pattern.test(text))
        && (mentionsParticipant || /\b(?:sei|siete|you|you're|smetti|smettila|smettetela|shut up)\b/i.test(text))
      return matched ? [message.role] : []
    }))]
  }

  static hasDirectPersonalAttack(history = [], participants = [], moderatorTag = '', permissiveness = Debate.DEFAULT_MODERATOR_PERMISSIVENESS) {
    return Debate.getDirectPersonalAttackTargets(history, participants, moderatorTag, permissiveness).length > 0
  }

  static updateConclusionConv(history, participants, conclusionConvRef) {
    conclusionConvRef.current = Debate.buildConclusionConversation(history, participants)
  }

  static applyDynamicAffinityUpdates({ participants = [], deltas = {}, moderatorIntervention = false, moderationTargets = [], moderationCooling = 0 }) {
    if (participants.length <= 1) {
      return { changed: false, participants }
    }

    const safeDeltas = deltas && typeof deltas === 'object' ? deltas : {}
    const byTag = Object.fromEntries(participants.map(participant => [participant.tag, participant]))
    const moderatedIds = new Set(moderationTargets
      .map(target => byTag[target]?.id ?? participants.find(participant => String(participant.id) === String(target))?.id)
      .filter(id => id != null))
    let changed = false
    const updated = participants.map(participant => {
      if (participant.isModerator && !participant.moderatorDynamicAffinity) return participant

      const row = safeDeltas[participant.tag]
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

      if (moderatorIntervention && moderatedIds.has(participant.id) && (!participant.isModerator || participant.moderatorDynamicAffinity)) {
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

  static shouldModeratorIntervene({ actor, history = [], participants = [], roundModerationSignal = null, round = 0 }) {
    const result = {
      shouldIntervene: false,
      scheduledFacilitation: false,
      reactiveModeration: false,
      moderationTargets: [],
    }

    if (!actor?.isModerator) return result

    const nonModeratorMsgs = history.filter(message => {
      if (!message.role || ['topic', 'interjection', 'participant_joined', 'participant_left', 'error', 'user'].includes(message.role)) return false
      const participant = participants.find(entry => entry.tag === message.role)
      return !!participant && !participant.isModerator && !!String(message.content || '').trim()
    })

    const hasContext = nonModeratorMsgs.length > 0
    if (!hasContext) return result

    const detectedAttackTargets = Debate.getDirectPersonalAttackTargets(
      history,
      participants,
      actor.tag,
      actor.moderatorPermissiveness,
    )
    const moderationTargets = detectedAttackTargets.length > 0
      ? detectedAttackTargets
      : Debate.normalizeModerationTargets(roundModerationSignal?.targets)
        .map(target => participants.find(participant => String(participant.tag || '').toLowerCase() === target.toLowerCase() && !participant.isModerator)?.tag)
        .filter(Boolean)
    const detectedAttack = detectedAttackTargets.length > 0
    const moderationRequested = !!roundModerationSignal?.needed || detectedAttack
    result.reactiveModeration = moderationRequested
    result.moderationTargets = moderationTargets
    const mode = Debate.normalizeModeratorMode(actor)

    if (mode === 'active') {
      result.shouldIntervene = true
      return result
    }

    if (mode === 'facilitator') {
      const turnLabel = round + 1
      const interval = normalizeModeratorFacilitationInterval(actor.moderatorFacilitationInterval)
      // The cadence is the whole promise of the setting: every N rounds means
      // every N rounds, the last one included. Excluding it used to drop the
      // only facilitation of a debate whose interval matched its length.
      //
      // A reactive moderation still preempts the scheduled synthesis: the turn
      // goes to containment, which is what the prompt and the rewrite guards
      // already assume when both would apply. With an interval of 1 the two
      // collide every round, so the decision has to settle it here.
      if (turnLabel % interval === 0 && !moderationRequested) {
        result.shouldIntervene = true
        result.scheduledFacilitation = true
        return result
      }
      result.shouldIntervene = moderationRequested
      return result
    }

    // Containment steps in only when the model signal or local attack detector
    // reports a concrete need (insults, escalation, derailment, or request).
    result.shouldIntervene = moderationRequested
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
          content: '',
          turn,
          seq: nextSeq(),
          participantSnapshot: message.participantSnapshot,
        })
      }
    }

    if (actor.localUser || actor.model === Debate.USER_MODEL) return messages

    const previous = latestEvents.get(actor.id)
    const hasChanged = previous?.role === 'participant_joined' && (
      previous.participantSnapshot.model !== actor.model ||
      previous.participantSnapshot.name !== actor.name ||
      !!previous.participantSnapshot.localUser !== !!actor.localUser ||
      !!previous.participantSnapshot.isModerator !== !!actor.isModerator ||
      (previous.participantSnapshot.endpointOverride ?? '') !== (actor.endpointOverride ?? '')
    )

    if (hasChanged) {
      messages.push({
        role: 'participant_left',
        content: '',
        turn,
        seq: nextSeq(),
        participantSnapshot: previous.participantSnapshot,
      })
    }

    if (!previous || previous.role === 'participant_left' || hasChanged) {
      messages.push({
        role: 'participant_joined',
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
      defaultModel,
      useSummaryRef,
      attachedDocs,
      summarizeAttachments,
      summaryModelOverride,
      summaryEndpointOverride,
      uiLang,
      handlePromptEstimate,
      handleRequest,
      handleResponse,
      characterContextRef,
      fetchedUrlsRef,
      setMessages,
      roundLimitRef,
      nextSeq,
      seqRef,
      summaryRef,
      summaryAccumulateThreshold,
      debugMode,
      setSummaryInProgress,
      setSummary,
      dynamicAffinity,
      randomTurnOrder,
      moderationCooling,
      setParticipants,
      setSummaryDebug,
      setStreamingSeq,
      setStreamingRole,
      globalConstraints,
      generalPersonalityInstructions,
      debateMode,
      enabledTools,
      userInputRejectRef,
      setUserInputPending,
      turnRef,
      interjectRef,
      conclusionConvRef,
      conclusionsRef,
      memoryRef,
      setMemory,
    } = runtime

    stopRef.current = false
    setStopping(false)
    setRunning(true)

    let parts = participantsRef.current
    const isRolePlay = normalizeDebateMode(debateMode) === 'role_play'
    const maxRounds = maxTurnsRef.current
    const timeoutMs = timeoutSecRef.current * 1000
    const baseUrl = baseUrlRef.current
    // Summaries may run on their own backend; falling back to the general one
    // keeps the setting optional.
    const summaryBaseUrl = summaryEndpointOverride?.trim() || baseUrl
    const useSummary = useSummaryRef.current
    const docs = attachedDocs
    let docsForPrompt = docs

    // Publish the topic or resume variation before optional attachment
    // summarization, so the UI does not wait for another LLM call.
    let history = resumeMessages ?? []
    let round = resumeRound?.round ?? 0
    let step = resumeRound?.step ?? 0
    let skipSummaryOnce = resumeRound?.skipSummary ?? false
    summaryRef.current = resumeSummary ?? ''
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
      setMessages(history)
    }

    // Publish the first actor's presence before attachment preparation. This
    // lets the UI show the topic and the participant while the first model is
    // still being prepared, without creating a duplicate presence event in
    // the normal turn loop.
    const firstActorIndex = resumeMessages ? (resumeRound?.step ?? 0) : 0
    const firstRawActor = parts[firstActorIndex] || parts[0]
    const firstActor = firstRawActor?.model
      ? firstRawActor
      : firstRawActor ? { ...firstRawActor, model: defaultModel || firstRawActor.model } : null
    if (firstActor) {
      const lifecycleMessages = Debate.buildParticipantLifecycleMessages({
        history,
        participants: parts,
        actor: firstActor,
        turn: (resumeRound?.round ?? 0) + 1,
        nextSeq,
      })
      if (lifecycleMessages.length > 0) {
        history = [...history, ...lifecycleMessages]
        setMessages(history)
      }
    }

    const transportCallbacks = (debugExchanges = null) => ({
      onPayload: request => {
        if (debugExchanges) debugExchanges.push({ request })
        handleRequest(request)
      },
      onResponse: exchange => {
        const debugExchange = debugExchanges?.find(entry => entry.request === exchange.request)
        if (debugExchange) debugExchange.response = exchange.response
        handleResponse(exchange)
      },
    })

    if (summarizeAttachments && docs.length > 0) {
      const summaryModel = Debate.pickOperationalModel(parts, summaryModelOverride, defaultModel)
      if (summaryModel) {
        try {
          const docSystem = Debate.buildDocumentSummarySystemPrompt(uiLang, LANGUAGES)
          const summarized = []
          for (const doc of docs) {
            let sum = ''
            await streamChat({
              baseUrl: summaryBaseUrl,
              model: summaryModel,
              useTools: false,
              timeoutMs,
              onEstimate: handlePromptEstimate,
              ...transportCallbacks(),
              systemPrompt: docSystem,
               messages: [{ role: 'user', content: Debate.buildDocumentSummaryPrompt(doc) }],
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

    let lastModerationTargets = []
    let pendingModeratorRequest = null
    // Who closed the previous round, so the next shuffle does not open with them.
    let lastRoundSpeakerId = null

    const queuedInterjections = () => {
      const queued = interjectRef.current
      return Array.isArray(queued) ? queued : (queued ? [queued] : [])
    }

    const syncHistory = () => {
      const nextHistory = queuedInterjections().reduce(
        (currentHistory, interjection) => Debate.appendInterjection(currentHistory, interjection),
        history,
      )
      setMessages(() => nextHistory)
    }

    const consumeQueuedInterjection = () => {
      const queued = queuedInterjections()
      if (queued.length === 0) return
      history = queued.reduce(
        (currentHistory, interjection) => Debate.appendInterjection(currentHistory, interjection),
        history,
      )
      interjectRef.current = null
      syncHistory()
    }

    const roundLimit = Debate.computeRoundLimit({
      hasResumeMessages: !!resumeMessages,
      currentRoundLimit: roundLimitRef.current,
      maxRounds,
      extraRounds,
    })
    roundLimitRef.current = roundLimit

    outer: while (true) {
      parts = participantsRef.current
      if (stopRef.current) break
      if (roundLimit > 0 && round >= roundLimit && step === 0) break

      const roundOrder = Debate.buildRoundOrder(parts, { randomize: !!randomTurnOrder, lastSpeakerId: lastRoundSpeakerId })
      lastRoundSpeakerId = roundOrder[roundOrder.length - 1] ?? null

       let roundModerationSignal = { needed: false, reason: '', targets: [] }

      {
        const isFirstTurn = Debate.isFirstDebateTurn(history)
        if (useSummary && !isFirstTurn && !skipSummaryOnce) {
          const prevSummary = summaryRef.current
          const participantCount = parts.length
          const nonTopicMsgs = history.filter(message => message.role !== 'topic')
          const forSummary = nonTopicMsgs.slice(-participantCount)
           const moderatorInterventionThisRound = lastModerationTargets.length > 0
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

          const summaryModel = Debate.pickOperationalModel(parts, summaryModelOverride, defaultModel)
          const summarySystem = Debate.buildRoundSummarySystemPrompt(uiLang, LANGUAGES)
          const debugPayloads = []
          const debugCalls = []

          const summaryCall = async (prompt, payloadsOut, kind = 'summary') => {
            const result = await streamChat({
              baseUrl: summaryBaseUrl,
              model: summaryModel,
               messages: [{ role: 'user', content: prompt }],
              systemPrompt: summarySystem,
              useTools: false,
              onToken: () => {},
              onEstimate: handlePromptEstimate,
              ...transportCallbacks(debugMode ? payloadsOut : null),
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
                      summaryAccumulateThreshold,
              moderatorInterventionThisRound,
              toSummarize,
            })
            const combinedRaw = await summaryCall(combinedPrompt, debugPayloads, 'summary+affinity')
            const bundle = Debate.parseSummaryAffinityBundle(combinedRaw)
            if (!bundle) throw new Error('Invalid summary/affinity JSON payload')
             const modelModerationSignal = bundle.moderation || { needed: false, reason: '', targets: [] }
             roundModerationSignal = {
               needed: !!(roundModerationSignal?.needed || modelModerationSignal.needed),
               reason: [roundModerationSignal?.reason || '', modelModerationSignal.reason || ''].filter(Boolean).join(' | '),
               targets: Debate.normalizeModerationTargets(modelModerationSignal.targets),
             }

            const trimmed = bundle.summary.trim()
            summaryRef.current = trimmed
            setSummary(trimmed)

            if (dynamicAffinity && parts.length > 1) {
              const affinityUpdate = Debate.applyDynamicAffinityUpdates({
                participants: parts,
                deltas: bundle.deltas,
                moderatorIntervention: lastModerationTargets.length > 0,
                moderationTargets: lastModerationTargets,
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
             lastModerationTargets = []
          } catch (err) {
            console.warn('[summary] fallita:', err.message)
          } finally {
            setSummaryInProgress(false)
          }
        }
        skipSummaryOnce = false
      }

      for (let s = step; s < parts.length || pendingModeratorRequest; s += 1) {
        const requestedModeratorTurn = pendingModeratorRequest
        pendingModeratorRequest = null
        const extraModeratorTurn = !!requestedModeratorTurn
        step = 0
        if (stopRef.current) break outer

        consumeQueuedInterjection()

        parts = participantsRef.current
        const cursorIndex = s < parts.length ? s : 0
        // The order is resolved by id so a participant added or removed mid
        // round cannot shift everyone else; the index is the fallback when the
        // roster changed under it.
        const scheduledId = roundOrder[cursorIndex]
        const rawActor = requestedModeratorTurn
          ? parts.find(participant => participant.isModerator)
          : (parts.find(participant => participant.id === scheduledId) ?? parts[cursorIndex])
        if (!rawActor) break
        const actor = rawActor.model ? rawActor : { ...rawActor, model: defaultModel || rawActor.model }
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
          syncHistory()
        }

        const realHistory = history
        const moderatorMode = actor.isModerator ? Debate.normalizeModeratorMode(actor) : null

        let moderationDecision = null
        if (actor.isModerator) {
          moderationDecision = isRolePlay
            ? {
                shouldIntervene: true,
                scheduledFacilitation: true,
                reactiveModeration: false,
                moderationTargets: [],
                reason: 'Role Play Master / Narrator turn.',
              }
            : extraModeratorTurn
            ? {
                shouldIntervene: true,
                scheduledFacilitation: true,
                reactiveModeration: false,
                moderationTargets: [],
                reason: requestedModeratorTurn.reason || 'A participant requested direct moderator intervention.',
              }
            : Debate.shouldModeratorIntervene({
                actor,
                history: realHistory,
                participants: parts,
                roundModerationSignal,
                round,
              })
          if (!moderationDecision.shouldIntervene) continue
          if (moderationDecision.reactiveModeration || extraModeratorTurn) {
            lastModerationTargets = moderationDecision.moderationTargets
          }
        }

        let activeMessageSeq = !actor.localUser && actor.model !== Debate.USER_MODEL ? nextSeq() : null
        if (activeMessageSeq != null) {
          const placeholder = {
            role: actor.tag,
            content: '',
            turn: turnLabel,
            seq: activeMessageSeq,
            participantSnapshot: { ...actor },
          }
          history = [...history, placeholder]
          syncHistory()
          setStreamingSeq(activeMessageSeq)
        }
        setStreamingRole(actor.tag)

        const nextStep = extraModeratorTurn
          ? (requestedModeratorTurn.afterStep ?? 0)
          : (cursorIndex + 1 < parts.length ? cursorIndex + 1 : 0)
        const nextRound = extraModeratorTurn || cursorIndex + 1 < parts.length ? round : round + 1
        turnRef.current = { round: nextRound, step: nextStep }

        if (stopRef.current) {
          history = history.slice(0, -1)
          syncHistory()
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
            const page = await Web.fetchAndSummarizePage(url, {
              summarizePage: async raw => {
                let summary = ''
                await streamChat({
                  baseUrl: actorBaseUrl,
                  model: actor.model,
                  // Sections and named links are what someone judging a site
                  // looks for, and a summary that drops them reads as if they
                  // were not there.
                  messages: [{ role: 'user', content: `Summarize the following page in a concise, neutral and informative way (150-250 words). Focus on key facts, claims, and context. Also list the sections, named links and legal or institutional pages that appear in it (about, contacts, privacy, cookies, terms, ethics, accessibility) and any rating or score shown. Do not editorialize, and do not report anything as missing.\n\nPage content:\n${raw}` }],
                  systemPrompt: 'You are a precise summarization assistant. Output only the summary, no preamble.',
                  useTools: false,
                  think: false,
                  onToken: token => { summary = token },
                  timeoutMs,
                })
                return summary
              },
            })
            // Failures are pushed too: silence about a page the participant was
            // asked to judge is what invites it to invent one.
            if (page?.text) urlContextBlocks.push(`### ${url}\n${page.text}`)
          }
        }

        const pushMsg = async (role, content) => {
          contextMessages.push({ role, content })
          await injectUrlsFrom(content)
        }

        const pushHistoryMsg = async message => {
          if (message.role === 'topic') {
            await pushMsg('user', `[Topic]: ${message.content}`)
          } else if (message.role === 'participant_joined' || message.role === 'participant_left') {
            return
          } else if (message.role === 'user') {
            await pushMsg('user', `[Moderator]: ${message.content}`)
          } else if (message.role === 'interjection') {
            await pushMsg('user', `[Topic update]: ${message.content}`)
          } else if (message.role === 'dice') {
            const ownerName = message.diceOwner?.name || message.diceOwner?.tag || 'a participant'
            await pushMsg('user', `[DICE RESULT — NUMBERS SHARED WITH ALL PARTICIPANTS]\nThe individual tool call was made by ${ownerName}. Preserve that ownership: use the result as established, do not claim the group rolled it, do not retract it, and do not roll it again.\n${message.content}`)
          } else if (message.role === actor.tag) {
            if (message.content && message.content.trim().startsWith('<function_calls>')) return
            if (!String(message.content ?? '').trim()) return
              contextMessages.push({ role: 'assistant', content: message.content })
           } else {
             if (message.content && message.content.trim().startsWith('<function_calls>')) return
             // A turn that produced nothing is not a contribution. Passing it on
             // as `Name said:` with no words makes the others read the table as
             // silent and spend their own turns asking who has not spoken yet.
             if (!String(message.content ?? '').trim()) return
             const other = parts.find(participant => participant.tag === message.role)
             const otherName = other?.name || other?.tag || message.role
             const content = other?.isModerator
               ? `[MODERATOR DIRECTIVE — PROCEDURAL AUTHORITY]\n${otherName}: ${message.content}\n\nThis is a binding process instruction. Follow it in your next response; do not debate or ignore it.`
               : `${otherName} said: ${message.content}`
             contextMessages.push({ role: 'user', content })
           }
        }

        const hasSummary = useSummary && !!summaryRef.current
        if (hasSummary) {
          // The actor's own messages inside this window still go in as
          // `assistant` (see pushHistoryMsg), so it keeps reading its previous
          // turns as its own words rather than as someone else's.
          const recentMessages = Debate.getRecentContext(realHistory, parts.length)
          for (const message of recentMessages) await pushHistoryMsg(message)
        } else {
          for (const message of realHistory) await pushHistoryMsg(message)
        }

        // Conclusions are shared analytical turns. Present them as ordinary
        // user-context messages so every participant can respond to them,
        // instead of hiding them in a side-channel JSON context.
        for (const conclusion of conclusionsRef?.current || []) {
          if (!conclusion?.content?.trim()) continue
          const title = conclusion.title || conclusion.type || 'Conclusion'
          await pushMsg('user', `[Shared conclusion — ${title}]\n${conclusion.content.trim()}`)
        }

        // The context size always applies: with a summary it bounds the recent
        // exchanges, without one it is the only thing keeping the payload sane.
        const cappedContext = Debate.capContextMessages(contextMessages, summaryAccumulateThreshold * 1024)
        contextMessages.splice(0, contextMessages.length, ...cappedContext)

        // Pinned outside the cap: dropping the summary would defeat its purpose.
        if (hasSummary) {
          contextMessages.unshift({ role: 'user', content: `[Conversation summary so far]\n${summaryRef.current}` })
        }

        // Keep dynamic conversation material visibly distinct from the system
        // instructions. The tag is a delimiter, not an instruction source.
        for (const message of contextMessages) {
          message.content = `<conversation_context>\n${message.content}\n</conversation_context>`
        }

        // Chat templates (Gemma among others) produce empty output when the
        // payload carries no user turn at all — which is exactly the shape of
        // the very first turn, where the topic lives in the system prompt.
        if (!contextMessages.some(message => message.role === 'user')) {
          contextMessages.push({ role: 'user', content: '<turn_request>\nThe debate starts now. Give your opening statement on the active topic, staying in character and following your system instructions.\n</turn_request>' })
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
                needed: !!moderationDecision?.reactiveModeration,
                reason: roundModerationSignal?.reason || (moderationDecision?.reactiveModeration ? 'personal attack or escalating hostility detected' : ''),
                scheduledFacilitation: !!moderationDecision?.scheduledFacilitation,
                reactiveModeration: !!moderationDecision?.reactiveModeration,
              }
            : null,
          characterContext,
          uiLang,
          attachedDocs: docsForPrompt,
          globalConstraints,
          generalPersonalityInstructions,
          debateMode: normalizeDebateMode(debateMode),
          constants: Debate.buildPromptConstants(),
        })
        if (urlContextBlocks.length > 0) {
          systemPrompt += `\n\n<fetched_sources>\nThe following pages have already been fetched for you. Do not search for them again.\n\nThis is everything you have observed about them. Treat it as a partial view: state what it shows, and never claim that a page or a site lacks something merely because it does not appear here — an absence you have not verified is a guess, not a finding.\n\n${urlContextBlocks.join('\n\n')}\n</fetched_sources>`
        }

        if (actor.localUser || actor.model === Debate.USER_MODEL) {
          try {
            const userText = await new Promise((resolve, reject) => {
              userInputRejectRef.current = reject
              setUserInputPending({ resolve, tag: actor.tag })
            })
            userInputRejectRef.current = null
            if (userText !== null) {
              const userMsg = { role: actor.tag, content: userText, turn: turnLabel, seq: nextSeq(), participantSnapshot: { ...actor } }
                history = [...history, userMsg]
                syncHistory()
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
          let previousToolMessageSeq = null
          let hasToolContinuation = false
          let moderationApplied = false
          let rawResponseContent = ''
          let completionReason = null
          const debugPayloads = []

          // Single place that creates the procedural moderation message, shared
          // by the tool executor and by the fallback below, so both produce an
          // identical message.
          const emitModerationMessage = reason => {
            moderationApplied = true
            history = [...history, {
              role: actor.tag,
              content: reason,
              turn: turnLabel,
              seq: nextSeq(),
              messageType: 'moderation',
              participantSnapshot: { ...actor },
            }]
            syncHistory()
          }
          const conversationToolExecutor = createConversationToolExecutor({
            getMessages: () => history,
            rollDice: isRolePlay
              ? args => {
                  const result = rollDice(args)
                  const activeIndex = history.findIndex(message => message.seq === activeMessageSeq)
                  const diceMessage = {
                    role: 'dice',
                    content: formatDiceRoll(result),
                    turn: turnLabel,
                    seq: nextSeq(),
                    beforeContent: !history[activeIndex]?.content?.trim(),
                    dice: result,
                    diceOwner: { id: actor.id, tag: actor.tag, name: actor.name },
                    participantSnapshot: { ...actor },
                  }
                  history = activeIndex >= 0
                    ? [...history.slice(0, activeIndex + 1), diceMessage, ...history.slice(activeIndex + 1)]
                    : [...history, diceMessage]
                  syncHistory()
                  return { ...result, shared: true, message: diceMessage.content }
                }
              : null,
            memory: async args => {
              const action = String(args?.action || '').trim().toLowerCase()
              if (action === 'read') return readMemory(memoryRef?.current || [], args)
              if (action !== 'write') return { accepted: false, reason: 'Memory action must be read or write.' }
              const content = String(args?.content || '').trim().slice(0, MEMORY_MAX_CONTENT_CHARS)
              if (!content) return { accepted: false, reason: 'Memory content is required for write.' }
              const entry = {
                id: `${actor.tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                authorTag: actor.tag,
                authorName: actor.name || actor.tag,
                content,
                turn: turnLabel,
                createdAt: new Date().toISOString(),
              }
              const nextMemory = [...(memoryRef?.current || []), entry].slice(-MEMORY_MAX_ENTRIES)
              if (memoryRef) memoryRef.current = nextMemory
              setMemory(nextMemory)
              return { saved: true, entry }
            },
            requestModeratorIntervention: args => {
              const moderatorAvailable = parts.some(participant => participant.isModerator)
              if (actor.isModerator || !moderatorAvailable || pendingModeratorRequest) {
                return { accepted: false, reason: actor.isModerator ? 'The moderator cannot request an extra moderator turn.' : 'A moderator intervention is already pending or unavailable.' }
              }
              const reason = String(args?.reason || '').trim()
              if (!reason) return { accepted: false, reason: 'A reason is required to request moderator intervention.' }
              pendingModeratorRequest = {
                reason,
                afterStep: cursorIndex + 1 < parts.length ? cursorIndex + 1 : 0,
              }
              return { accepted: true, message: 'Moderator intervention scheduled as an extra turn outside the standard round.' }
            },
            applyModeration: args => {
              if (!actor.isModerator) return { accepted: false, reason: 'Only the debate moderator can apply moderation.' }
              const reason = String(args?.reason || '').trim()
              if (!reason) return { accepted: false, reason: 'A reason is required to apply moderation.' }
              emitModerationMessage(reason)
              return { accepted: true, message: 'Moderation applied as a separate procedural message.' }
            },
          })
          const availableTools = [
            ...(parts.some(participant => participant.isModerator)
            ? (isRolePlay ? ROLE_PLAY_TOOLS : LLM_TOOLS)
            : (isRolePlay ? ROLE_PLAY_TOOLS_WITHOUT_MODERATOR_INTERVENTION : LLM_TOOLS_WITHOUT_MODERATOR_INTERVENTION)),
            ...(actor.isModerator ? MODERATOR_TOOLS : []),
          ].filter(tool => enabledTools?.[tool.function.name] !== false)
          const full = await streamChat({
            baseUrl: actorBaseUrl,
            model: actor.model,
            messages: contextMessages,
            systemPrompt,
            useTools: true,
            tools: availableTools,
            think: actor.thinkingLevel === 'none' ? false : Debate.normalizeThinkingLevel(actor.thinkingLevel),
            executeTool: conversationToolExecutor,
            onToolInvocation: invocation => {
              history = history.map(message => message.seq === activeMessageSeq
                ? {
                    ...message,
                    toolInvocations: [...(message.toolInvocations || []), invocation],
                    toolEvents: [
                      ...(message.toolEvents || []),
                      { type: 'invocation', invocation, beforeContent: !message.content?.trim() },
                    ],
                  }
                : message)
              syncHistory()
            },
            onToolRound: ({ content }) => {
              // A tool call starts a new assistant segment. Persist the text
              // already received and let the continuation render in its own
              // balloon, so tool rounds cannot overwrite the first response.
              hasToolContinuation = true
              previousToolMessageSeq = activeMessageSeq
              // Ollama commonly emits a tool-only assistant message first.
              // It is not an empty answer: it is the transport half of the
              // same assistant turn. Keep the active sequence unchanged so
              // the following visible response fills this message directly.
              if (!content?.trim()) {
                previousToolMessageSeq = null
                return
              }
              if (content?.trim()) {
                history = history.map(message => message.seq === activeMessageSeq
                  ? { ...message, content: content.trim(), rawContent: rawResponseContent || content.trim(), completionReason }
                  : message)
              }
              activeMessageSeq = nextSeq()
              history = [...history, {
                role: actor.tag,
                content: '',
                turn: turnLabel,
                seq: activeMessageSeq,
                participantSnapshot: { ...actor },
              }]
              setStreamingSeq(activeMessageSeq)
              syncHistory()
            },
            sourceUrls,
            onEstimate: handlePromptEstimate,
            onComplete: ({ visibleContent, doneReason }) => {
              rawResponseContent = visibleContent || ''
              completionReason = doneReason || null
            },
            onThinking: thinking => {
              history = history.map(message => message.seq === activeMessageSeq
                ? { ...message, thinking }
                : message)
              syncHistory()
            },
            ...transportCallbacks(debugMode ? debugPayloads : null),
            onToken: text => {
              history = history.map(message => message.seq === activeMessageSeq ? { ...message, content: text } : message)
               syncHistory()
            },
            timeoutMs,
          })
          const activeStreamContent = history.find(message => message.seq === activeMessageSeq)?.content ?? ''
          // The provider can report the visible text through either the
          // stream return value, onComplete, or the last onToken callback.
          // Prefer the first non-empty representation so a tool-only first
          // response can never mask the following assistant response.
          const finalContent = [full, rawResponseContent, activeStreamContent]
            .find(content => String(content || '').trim()) || ''
          let resolvedContent = finalContent

          // The prompt demands an apply_moderation call whenever a procedural
          // intervention is due, but models comply unreliably. Retry once with
          // an explicit reminder, then fall back to building the message from
          // whatever the model produced: the intervention must not depend on
          // the model choosing to emit a tool call.
          const moderationRequired = actor.isModerator
            && !isRolePlay
            && !!moderationDecision?.reactiveModeration
          if (moderationRequired && !moderationApplied) {
            console.warn(`[moderation] ${actor.name || actor.tag}: apply_moderation not called — retrying once`)
            let retryContent = ''
            try {
              await streamChat({
                baseUrl: actorBaseUrl,
                model: actor.model,
                messages: [
                  ...contextMessages,
                  { role: 'user', content: 'You did not emit the required apply_moderation tool call. Emit exactly one apply_moderation tool call now, with a concise reason/directive. Do not write any visible text.' },
                ],
                systemPrompt,
                useTools: true,
                tools: availableTools.filter(tool => tool.function.name === 'apply_moderation'),
                think: false,
                executeTool: conversationToolExecutor,
                onEstimate: handlePromptEstimate,
                ...transportCallbacks(debugMode ? debugPayloads : null),
                onToken: token => { retryContent = token },
                timeoutMs,
              })
            } catch (retryError) {
              console.warn(`[moderation] retry failed: ${retryError.message}`)
            }

            if (!moderationApplied) {
              // Last resort: the visible text is the intervention the model
              // wrote instead of calling the tool. [SKIP_TURN] means it kept
              // silent, so the trigger reason is used instead.
              const spoken = [resolvedContent, retryContent]
                .map(text => String(text || '').trim())
                .find(text => text && !/^\[SKIP_TURN\]$/i.test(text))
              const reason = spoken || String(roundModerationSignal?.reason || '').trim()
              if (reason) {
                console.warn(`[moderation] falling back to a synthesised moderation message`)
                emitModerationMessage(reason)
                if (spoken && spoken === resolvedContent.trim()) resolvedContent = ''
              }
            }
          }

          if (hasToolContinuation && previousToolMessageSeq != null && resolvedContent.trim()) {
            const reconciled = reconcileToolContinuation(history, previousToolMessageSeq, activeMessageSeq, resolvedContent)
            history = reconciled.history
            activeMessageSeq = reconciled.activeSeq
            setStreamingSeq(activeMessageSeq)
            resolvedContent = reconciled.content
            syncHistory()
          }
          if (!resolvedContent.trim() && hasToolContinuation && previousToolMessageSeq != null) {
            history = carryToolInvocations(history, activeMessageSeq, previousToolMessageSeq)
              .filter(message => message.seq !== activeMessageSeq)
            activeMessageSeq = previousToolMessageSeq
            setStreamingSeq(activeMessageSeq)
            syncHistory()
            resolvedContent = history.find(message => message.seq === activeMessageSeq)?.content ?? ''
          }
          // A tool-first turn may have no visible assistant text at all. Keep
          // its placeholder when it contains invocations, otherwise the tool
          // pill would disappear together with the empty response.
          if (!resolvedContent.trim() && moderationApplied) {
            history = history.map(message => message.seq === activeMessageSeq
              ? { ...message, content: '' }
              : message)
            syncHistory()
            setStreamingRole(null)
            setStreamingSeq(null)
            continue
          }
          if (!resolvedContent.trim() && hasToolContinuation && previousToolMessageSeq == null) {
            const activeMessage = history.find(message => message.seq === activeMessageSeq)
            if (activeMessage?.toolInvocations?.length) {
              syncHistory()
              setStreamingRole(null)
              setStreamingSeq(null)
              continue
            }
          }
          // [SKIP_TURN] is an internal marker and must never reach the chat,
          // whether or not a moderation message was produced. With one, the
          // placeholder stays so its tool pill survives; without one there is
          // nothing left to show, so the turn is dropped entirely.
          if (actor.isModerator && /^\s*\[SKIP_TURN\]\s*$/i.test(resolvedContent)) {
            history = moderationApplied
              ? history.map(message => message.seq === activeMessageSeq ? { ...message, content: '' } : message)
              : history.filter(message => message.seq !== activeMessageSeq)
            syncHistory()
            setStreamingRole(null)
            setStreamingSeq(null)
            continue
          }
          let moderatedContent = resolvedContent
          // Directive-style rewrite only applies to containment interventions:
          // active moderators contribute content, and scheduled facilitation
          // turns are analytical by design — rewriting would destroy both.
          const skipModeratorRewrite = moderatorMode === 'active' || (moderationDecision?.scheduledFacilitation && !moderationDecision?.reactiveModeration)
          if (actor.isModerator && resolvedContent.trim() && !skipModeratorRewrite && !Debate.isModerationDirectiveStyle(resolvedContent)) {
            let rewrite = ''
            const draftMessageSeq = activeMessageSeq
            const rewriteMessageSeq = nextSeq()
            history = [...history, {
              role: actor.tag,
              content: '',
              turn: turnLabel,
              seq: rewriteMessageSeq,
              participantSnapshot: { ...actor },
            }]
            activeMessageSeq = rewriteMessageSeq
            setStreamingSeq(rewriteMessageSeq)
            syncHistory()
            try {
              await streamChat({
                baseUrl: actorBaseUrl,
                model: actor.model,
                useTools: false,
                timeoutMs,
                onEstimate: handlePromptEstimate,
                ...transportCallbacks(),
                systemPrompt: `You are a strict process moderator. Do not summarize positions. Output only operational moderation in ${outputLanguagePhrase(uiLang, LANGUAGES)}.`,
                messages: [{
                  role: 'user',
                  content: `Rewrite this moderator draft as a REAL moderation intervention (not a recap, not a synthesis).\n\nDraft:\n${resolvedContent}\n\nOutput format (mandatory, 3 short lines, in the user's language):\n1) <brief reason for intervention now>\n2) <directive: what must change immediately>\n3) <next turn: who should answer and with what focus>\n\nUse labels naturally in that language. Avoid the word "trigger".\nMax 5 total sentences. No preamble.`,
                }],
                onToken: token => {
                  rewrite = token
                  history = history.map(message => message.seq === rewriteMessageSeq ? { ...message, content: token } : message)
                  syncHistory()
                },
              })
              if (rewrite.trim() && Debate.isModerationDirectiveStyle(rewrite)) {
                moderatedContent = rewrite.trim()
              } else {
                history = history.filter(message => message.seq !== rewriteMessageSeq)
                activeMessageSeq = draftMessageSeq
                setStreamingSeq(draftMessageSeq)
                syncHistory()
              }
            } catch {
              // fallback: keep original output
              history = history.filter(message => message.seq !== rewriteMessageSeq)
              activeMessageSeq = draftMessageSeq
              setStreamingSeq(draftMessageSeq)
              syncHistory()
            }
          }
          if (moderatedContent.trim()) {
            history = history.map(message => message.seq === activeMessageSeq ? {
              ...message,
              content: moderatedContent,
              ...(rawResponseContent ? { rawContent: rawResponseContent } : {}),
              ...(completionReason ? { completionReason } : {}),
              ...(debugMode && debugPayloads.length > 0 ? { payload: debugPayloads.at(-1), debugPayloads } : {}),
            } : message)
          } else if (actor.isModerator) {
            history = history.filter(message => message.seq !== activeMessageSeq)
          } else {
            const emptyMsg = {
              role: 'error',
              nonFatal: true,
              content: `⚠ ${actor.name || actor.tag}: empty response from ${actor.model} — skipping this turn.`,
              turn: turnLabel,
              seq: nextSeq(),
            }
            history = [...history.filter(message => message.seq !== activeMessageSeq), emptyMsg]
          }
           syncHistory()
        } catch (err) {
          const errMsg = {
            role: 'error',
            content: `⚠ ${err.message} — use the Resume button to retry from this point.`,
            turn: turnLabel,
            seq: nextSeq(),
          }
          history = [...history.filter(message => message.seq !== activeMessageSeq), errMsg]
          syncHistory()
          turnRef.current = { round, step: s, skipSummary: true }
          setStreamingRole(null)
          setStreamingSeq(null)
          setStopping(false)
          setRunning(false)
          return
        }

        consumeQueuedInterjection()

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
