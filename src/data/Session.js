import { topicToSlug } from '../utils/Slug'
import { DEFAULT_RESPONSE_LENGTH } from '../prompts/ResponseLengths'

export class Session {
  static serializeParticipant(p, { DEFAULT_MOOD, DEFAULT_MOOD_INTENSITY, DEFAULT_EDUCATION_LEVEL, DEFAULT_AGE_GROUP, normalizeAffinity, normalizeAffinityLocks, normalizeConstraints, normalizeModeratorMode, normalizeModeratorPermissiveness }) {
    return {
      id: p.id,
      model: p.model,
      endpointOverride: p.endpointOverride ?? '',
      name: p.name,
      isModerator: !!p.isModerator || p.mood === 'moderator',
      moderatorMode: normalizeModeratorMode(p),
      moderatorPermissiveness: normalizeModeratorPermissiveness(p.moderatorPermissiveness),
      moderatorDynamicAffinity: !!p.moderatorDynamicAffinity,
      moderatorFactCheck: !!p.moderatorFactCheck,
      moderatorEnforceTopic: !!p.moderatorEnforceTopic,
      mood: p.mood === 'moderator' ? DEFAULT_MOOD : p.mood,
      moodIntensity: p.moodIntensity ?? DEFAULT_MOOD_INTENSITY,
      reasoningLang: p.reasoningLang ?? '',
      reasoningLangSkipTranslation: !!p.reasoningLangSkipTranslation,
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

  static hydrateParticipant(p, i, { mkParticipant, DEFAULT_MOOD, DEFAULT_MOOD_INTENSITY, DEFAULT_EDUCATION_LEVEL, DEFAULT_AGE_GROUP, normalizeAffinity, normalizeAffinityLocks, normalizeConstraints, normalizeModeratorMode, normalizeModeratorPermissiveness }) {
    return {
      ...mkParticipant(i, p.model),
      endpointOverride: p.endpointOverride ?? '',
      name: p.name ?? '',
      isModerator: !!p.isModerator || p.mood === 'moderator',
      moderatorMode: normalizeModeratorMode(p),
      moderatorPermissiveness: normalizeModeratorPermissiveness(p.moderatorPermissiveness),
      moderatorDynamicAffinity: !!p.moderatorDynamicAffinity,
      moderatorFactCheck: !!p.moderatorFactCheck,
      moderatorEnforceTopic: !!p.moderatorEnforceTopic,
      mood: p.mood === 'moderator' ? DEFAULT_MOOD : (p.mood ?? DEFAULT_MOOD),
      moodIntensity: p.moodIntensity ?? DEFAULT_MOOD_INTENSITY,
      reasoningLang: p.reasoningLang ?? '',
      reasoningLangSkipTranslation: !!p.reasoningLangSkipTranslation,
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

  static buildSnapshotData({ participants, globalConstraints, generalPersonalityInstructions, debateMode, customConclusionPrompt, standardConclusionPrompt, maxTurns, timeoutSec, baseUrl, moderationCooling, summarizeAttachments, topic, messages, summary, turn, conclusions, constants }) {
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
