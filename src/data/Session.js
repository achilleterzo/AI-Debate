import { topicToSlug } from '../utils/Slug'
import { DEFAULT_RESPONSE_LENGTH } from '../prompts/ResponseLengths'
import { extractLeakedReasoning, stripLeakedReasoning, visibleContribution } from '../prompts/ReasoningLeak'

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
      moderatorFactCheck: !!p.moderatorFactCheck,
      moderatorEnforceTopic: !!p.moderatorEnforceTopic,
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
      moderatorFactCheck: !!p.moderatorFactCheck,
      moderatorEnforceTopic: !!p.moderatorEnforceTopic,
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

  static buildSnapshotData({ participants, globalConstraints, generalPersonalityInstructions, debateMode, customConclusionPrompt, standardConclusionPrompt, maxTurns, timeoutSec, baseUrl, moderationCooling, summarizeAttachments, topic, messages, summary, turn, conclusions, memory, constants }) {
    return {
      version: 2,
      savedAt: new Date().toISOString(),
      participants: participants.map(participant => Session.serializeParticipant(participant, constants)),
      globalConstraints,
      generalPersonalityInstructions,
      debateMode,
      customConclusionPrompt,
      standardConclusionPrompt,
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
