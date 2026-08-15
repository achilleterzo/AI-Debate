import { topicToSlug } from '../utils/Slug'
import { DEFAULT_RESPONSE_LENGTH } from '../prompts/ResponseLengths'
import { extractLeakedReasoning, stripLeakedReasoning, visibleContribution } from '../prompts/ReasoningLeak'

// What Data.exportJSON writes in place of a stored value. The export resolves
// state into labels for a human reader, so reading one back means undoing that.
const EXPORT_VERBOSITY_PREFIX = 'Verbosity: '
const EXPORT_FREE_VERBOSITY = 'free'
const EXPORT_DEFAULT_CHARACTER_TYPE = 'person'

function responseLengthFromExport(label) {
  const text = String(label ?? '').trim()
  const value = text.startsWith(EXPORT_VERBOSITY_PREFIX) ? text.slice(EXPORT_VERBOSITY_PREFIX.length).trim() : text
  // `free` is the placeholder the export writes for "no preference", which is
  // not a value RESPONSE_LENGTHS holds.
  return !value || value === EXPORT_FREE_VERBOSITY ? null : value
}

export class Session {
  static KEPT_WITHOUT_CONTENT = new Set([
    'topic',
    'user',
    'interjection',
    'error',
    'participant_joined',
    'participant_left',
  ])

  static serializeParticipant(p, { DEFAULT_MOOD, DEFAULT_MOOD_INTENSITY, DEFAULT_EDUCATION_LEVEL, DEFAULT_AGE_GROUP, INHERIT_THINKING_LEVEL, normalizeAffinity, normalizeAffinityLocks, normalizeConstraints, normalizeModeratorMode, normalizeModeratorPermissiveness, normalizeModeratorFacilitationInterval, normalizeThinkingLevelChoice }) {
    return {
      id: p.id,
      model: p.model === '__user__' ? '' : p.model,
      localUser: !!p.localUser || p.model === '__user__',
      endpointOverride: p.endpointOverride ?? '',
      name: p.name,
      isModerator: !!p.isModerator || p.mood === 'moderator',
      moderatorMode: normalizeModeratorMode(p),
      moderatorPermissiveness: normalizeModeratorPermissiveness(p.moderatorPermissiveness),
      moderatorFacilitationInterval: normalizeModeratorFacilitationInterval(p.moderatorFacilitationInterval),
      moderatorDynamicAffinity: !!p.moderatorDynamicAffinity,
      mood: p.mood === 'moderator' ? DEFAULT_MOOD : p.mood,
      moodIntensity: p.moodIntensity ?? DEFAULT_MOOD_INTENSITY,
      reasoningLang: p.reasoningLang ?? '',
      reasoningLangCustom: p.reasoningLangCustom ?? '',
      reasoningLangSkipTranslation: !!p.reasoningLangSkipTranslation,
      // No level of their own means the participant follows the general default.
      thinkingLevel: normalizeThinkingLevelChoice(p.thinkingLevel ?? INHERIT_THINKING_LEVEL),
      characterType: p.characterType ?? null,
      responseLength: p.responseLength === undefined ? DEFAULT_RESPONSE_LENGTH : p.responseLength,
      educationLevel: p.educationLevel ?? DEFAULT_EDUCATION_LEVEL,
      ageGroup: p.ageGroup ?? DEFAULT_AGE_GROUP,
      tag: p.tag,
      affinity: normalizeAffinity(p.affinity),
      affinityLocks: normalizeAffinityLocks(p.affinityLocks),
      constraints: normalizeConstraints(p.constraints),
    }
  }

  static hydrateParticipant(p, i, { mkParticipant, DEFAULT_MOOD, DEFAULT_MOOD_INTENSITY, DEFAULT_EDUCATION_LEVEL, DEFAULT_AGE_GROUP, INHERIT_THINKING_LEVEL, normalizeAffinity, normalizeAffinityLocks, normalizeConstraints, normalizeModeratorMode, normalizeModeratorPermissiveness, normalizeModeratorFacilitationInterval, normalizeThinkingLevelChoice }) {
    return {
      ...mkParticipant(i, p.model === '__user__' ? '' : p.model),
      model: p.model === '__user__' ? '' : (p.model ?? ''),
      localUser: !!p.localUser || p.model === '__user__',
      endpointOverride: p.endpointOverride ?? '',
      name: p.name ?? '',
      isModerator: !!p.isModerator || p.mood === 'moderator',
      moderatorMode: normalizeModeratorMode(p),
      moderatorPermissiveness: normalizeModeratorPermissiveness(p.moderatorPermissiveness),
      moderatorFacilitationInterval: normalizeModeratorFacilitationInterval(p.moderatorFacilitationInterval),
      moderatorDynamicAffinity: !!p.moderatorDynamicAffinity,
      mood: p.mood === 'moderator' ? DEFAULT_MOOD : (p.mood ?? DEFAULT_MOOD),
      moodIntensity: p.moodIntensity ?? DEFAULT_MOOD_INTENSITY,
      reasoningLang: p.reasoningLang ?? '',
      reasoningLangCustom: p.reasoningLangCustom ?? '',
      reasoningLangSkipTranslation: !!p.reasoningLangSkipTranslation,
      // No level of their own means the participant follows the general default.
      thinkingLevel: normalizeThinkingLevelChoice(p.thinkingLevel ?? INHERIT_THINKING_LEVEL),
      characterType: p.characterType ?? null,
      responseLength: p.responseLength === undefined ? DEFAULT_RESPONSE_LENGTH : p.responseLength,
      educationLevel: p.educationLevel ?? DEFAULT_EDUCATION_LEVEL,
      ageGroup: p.ageGroup ?? DEFAULT_AGE_GROUP,
      affinity: normalizeAffinity(p.affinity),
      affinityLocks: normalizeAffinityLocks(p.affinityLocks),
      constraints: normalizeConstraints(p.constraints),
    }
  }

  static stripDebugFields(messages) {
    return messages.map(message => {
      const { payload, debugPayloads, ollamaRole, ...rest } = message
      void payload
      void debugPayloads
      void ollamaRole
      return rest
    })
  }

  /**
   * The messages of a snapshot that are worth restoring.
   *
   * A message with no text is normally a turn that produced nothing, and
   * loading it back would restore an empty balloon. The listed roles are not
   * that: a presence event carries its whole meaning in `participantSnapshot`,
   * and a topic or an interjection can legitimately be blank. Dropping the
   * presence events left a restored session with no record of who had already
   * entered, so the first resumed turn announced every participant again.
   */
  static restorableMessages(messages = []) {
    return messages
      .map(({ ollamaRole, ...message }) => {
        void ollamaRole
        // A transcript written before the stream learned to strip them still
        // carries reasoning blocks inside `content`. Restoring one as it stands
        // puts that monologue back into the chat and into every payload built
        // from it, so it is moved where it belongs on the way in.
        const content = visibleContribution(message.content)
        if (content === String(message.content ?? '')) return message
        // Only a block the model actually closed is filed away as thinking:
        // when the fallback had to keep an unclosed tail, that text is the
        // message, and copying it into `thinking` would duplicate the turn.
        const leaked = stripLeakedReasoning(message.content).trim() ? extractLeakedReasoning(message.content) : ''
        return {
          ...message,
          content,
          ...(leaked && !String(message.thinking ?? '').trim() ? { thinking: leaked } : {}),
        }
      })
      .filter(message => Session.KEPT_WITHOUT_CONTENT.has(message.role) || String(message.content ?? '').trim())
  }

  static buildSnapshotData({ participants, globalConstraints, generalPersonalityInstructions, debateMode, customConclusionPrompt, standardConclusionPrompts, maxTurns, timeoutSec, baseUrl, moderationCooling, summarizeAttachments, topic, messages, summary, turn, conclusions, memory, constants }) {
    return {
      version: 2,
      savedAt: new Date().toISOString(),
      participants: participants.map(participant => Session.serializeParticipant(participant, constants)),
      globalConstraints,
      generalPersonalityInstructions,
      debateMode,
      customConclusionPrompt,
      standardConclusionPrompts,
      maxTurns,
      timeoutSec,
      baseUrl,
      moderationCooling,
      summarizeAttachments,
      topic,
      messages: Session.stripDebugFields(messages),
      summary,
      turn,
      conclusions,
      memory: Array.isArray(memory) ? memory : [],
    }
  }

  /**
   * Whether a loaded file is a JSON export rather than a snapshot.
   *
   * A snapshot is stamped `version: 2`; the export is stamped with the moment
   * and the app version that produced it. Requiring a transcript on top keeps
   * an unrelated JSON that happens to carry an `exported` key out of the
   * import path — it falls through to the invalid-file message instead.
   */
  static isExportedSession(data) {
    return !!data
      && data.version == null
      && Array.isArray(data.messages)
      && (typeof data.exported === 'string' || typeof data.appVersion === 'string')
  }

  /**
   * An exported participant read back into the shape hydration expects.
   *
   * The export carries what a reader needs to know about a persona, not what
   * the app needs to run it: there is no model, no endpoint-level thinking
   * choice, no affinity and — the one that matters most — no constraints, so
   * the roster comes back as named placeholders rather than as the people who
   * held the debate. Fields the export omitted are left off entirely so that
   * hydration applies its own defaults instead of storing a null.
   */
  static participantFromExport(participant = {}, index = 0) {
    return {
      id: index,
      model: '',
      localUser: false,
      endpointOverride: participant.endpointOverride ?? '',
      name: participant.name ?? '',
      isModerator: !!participant.isModerator,
      // CHARACTER_TYPES has no `person` entry: that is what the export writes
      // for a participant with no character type at all.
      characterType: participant.characterType && participant.characterType !== EXPORT_DEFAULT_CHARACTER_TYPE
        ? participant.characterType
        : null,
      responseLength: responseLengthFromExport(participant.responseLength),
      tag: participant.tag,
      constraints: [],
      ...(participant.mood ? { mood: participant.mood } : {}),
      ...(participant.moodIntensity != null ? { moodIntensity: participant.moodIntensity } : {}),
      ...(participant.age != null ? { ageGroup: participant.age } : {}),
      ...(participant.education ? { educationLevel: participant.education } : {}),
    }
  }

  /**
   * Exported messages read back, with the speaker put back on each one.
   *
   * The export replaced `participantSnapshot` with the actor's display name,
   * which is enough for a reader and not enough for the timeline: a join or
   * leave event carries its whole meaning in that snapshot and would render as
   * "?" without it. Ordinary turns are matched by tag, presence events by the
   * name the export printed.
   */
  static messagesFromExport(messages = [], participants = []) {
    const byTag = new Map(participants.map(participant => [participant.tag, participant]))
    const byName = new Map(participants.filter(participant => participant.name).map(participant => [participant.name, participant]))
    return messages.map(({ id, actor, actorIsModerator, kind, ...message }) => {
      // Both are derived from the speaker the timeline resolves for itself.
      void actorIsModerator
      void kind
      const owner = byTag.get(message.role) ?? (actor ? byName.get(actor) ?? byTag.get(actor) : null) ?? null
      return {
        ...message,
        ...(id != null ? { seq: id } : {}),
        ...(owner ? { participantSnapshot: { ...owner } } : {}),
      }
    })
  }

  /**
   * A JSON export mapped onto the snapshot shape, so one loader reads both.
   *
   * What survives the round trip is the conversation — topic, transcript,
   * conclusions, summary — plus enough of the roster to render it. The debate
   * settings are not in an export at all: rounds, timeout, cooling, the global
   * constraints and the shared instructions stay whatever they already were,
   * because a file that does not mention them is not an instruction to change
   * them. The memory is the exception, and is cleared: annotations belong to
   * the debate that wrote them, and keeping the current ones next to an
   * imported transcript would credit them to a session that never made them.
   */
  static fromExportedSession(data, constants) {
    const participants = (Array.isArray(data.participants) ? data.participants : [])
      .map((participant, index) => Session.participantFromExport(participant, index))
    // Hydrated here only to stamp the messages: a snapshot's participant
    // snapshots carry the palette, which a roster only receives on the way in.
    // The loader hydrates the roster itself from `participants` below.
    const hydrated = participants.map((participant, index) => Session.hydrateParticipant(participant, index, constants))
    const messages = Session.messagesFromExport(data.messages, hydrated)
    const rounds = messages.map(message => Number(message.turn)).filter(Number.isFinite)

    return {
      version: 2,
      savedAt: data.exported ?? null,
      participants,
      debateMode: data.debateMode,
      baseUrl: data.baseUrl,
      // An export has no top-level topic — it is the opening message.
      topic: messages.find(message => message.role === 'topic')?.content ?? '',
      messages,
      summary: data.summary ?? '',
      conclusions: Array.isArray(data.conclusions) ? data.conclusions : [],
      memory: [],
      // Where a snapshot of this session would have left the cursor: the
      // highest round the transcript reached, at its first step.
      turn: rounds.length ? { round: Math.max(...rounds), step: 0 } : null,
    }
  }

  static downloadSnapshot(snapshot, { topic, messages }) {
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
    const anchor = document.createElement('a')
    anchor.href = URL.createObjectURL(blob)
    const dateStr = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-')
    const topicText = (messages.find(message => message.role === 'topic')?.content || topic).trim()
    const topicSlug = topicToSlug(topicText)
    anchor.download = topicSlug ? `ai-debate-${topicSlug}-${dateStr}.json` : `ai-debate-snapshot-${dateStr}.json`
    anchor.click()
  }

  static promptSnapshotFile({ onData, onError }) {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = event => {
      const file = event.target.files[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = loadEvent => {
        try {
          onData(JSON.parse(loadEvent.target.result))
        } catch {
          onError()
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  static createExportItems({ labels, exporters, enabled, buildArgs, onAfterExport }) {
    return [
      { label: labels.html, fn: exporters.html },
      { label: labels.markdown, fn: exporters.markdown },
      { label: labels.json, fn: exporters.json },
    ].map(({ label, fn }) => ({
      label,
      disabled: !enabled,
      onClick: () => {
        fn(buildArgs())
        onAfterExport?.()
      },
    }))
  }

  static requestClearSettings({ openConfirm, title, message, confirmLabel, onConfirm }) {
    openConfirm(
      {
        title,
        message,
        confirmLabel,
        danger: true,
      },
      onConfirm,
    )
  }
}
