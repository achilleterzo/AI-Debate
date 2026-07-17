export const UI_LANGUAGE_OPTIONS = [
  { code: 'it', label: 'Italian' },
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'pt', label: 'Português' },
  { code: 'ru', label: 'Русский' },
  { code: 'zh', label: '中文' },
  { code: 'ar', label: 'العربية' },
  { code: 'ja', label: '日本語' },
]

export const UI_OPTION_LABELS = {
  characterTypes: { default: 'Person', historical: 'Historical figure', public: 'Public figure', fictional: 'Fictional character' },
  ageGroups: ['Child', 'Teenager', 'Adult', 'Mature', 'Elder'],
  responseLengths: { short: 'Short', medium: 'Medium', detailed: 'Detailed', default: 'Free' },
  educationLevels: { default: 'Model default', street: 'Street-smart', primary: 'Primary school', proficient: 'Proficient', academic: 'Academic', expert: 'Expert' },
  moodIntensity: ['Low', 'Light', 'Balanced', 'Strong', 'Extreme'],
  moods: {
    none: 'Neutral', cooperative: 'Cooperative', socratic: 'Socratic', diplomatic: 'Diplomatic', devil: "Devil's Advocate", antagonist: 'Antagonist', frivolous: 'Frivolous', flirt: 'Flirt', liar: 'Liar', denialist: 'Denialist', analytical: 'Analytical', factchecker: 'Factchecker', therapist: 'Therapist',
  },
}

export const UI_STRINGS = {
  common: { cancel: 'Cancel', save: 'Save', remove: 'Remove', edit: 'Edit', add: 'Add', confirm: 'Confirm', reset: 'Reset', copy: 'Copy', user: 'User', moderator: 'Moderator', cloud: 'Cloud', local: 'Local', noModels: 'No models', chooseModel: '— choose model —' },
  topMenu: { title: 'Settings', export: 'Export', saveSnapshot: 'Save JSON snapshot', loadSnapshot: 'Load JSON snapshot', promptSettings: 'Settings', clearSavedSettings: 'Clear saved settings', exportHtml: 'Export HTML', exportMarkdown: 'Export Markdown', exportJson: 'Export JSON' },
  userInput: { skip: 'Skip', send: 'Send' },
  payloadModal: { title: 'PAYLOAD SENT', copy: 'Copy' },
  constraintModal: { removeTitle: 'Remove constraint', editTitle: 'Edit constraint', newTitle: 'New constraint', globalSubtitle: 'Global constraint (applies to everyone)', participantSubtitle: tag => `Participant constraint ${tag}`.trim(), confirmRemove: 'Confirm removal of this constraint?', placeholder: 'Write the constraint...', history: 'Constraint history', removeFromHistory: 'Remove from history', selectSaved: 'Select saved constraint...', noConstraints: 'No constraints' },
  confirmModal: { defaultConfirm: 'Confirm' },
  endpointModal: { title: 'Participant custom endpoint', clearTitle: 'Remove custom endpoint', emptyHint: 'Leave empty to use the general endpoint.' },
  promptSettingsModal: { title: 'Settings', description: 'General instructions sent in the system payload to all participants', resetDefault: 'Reset default' },
  topBar: {},
  chat: { empty: 'No messages yet', topic: 'Topic', variation: 'Variation', user: 'User', resume: 'Resume', left: 'left', joined: 'joined', round: n => `round ${n}`, moderation: 'Moderation', copyResponse: 'Copy response', inspectPayload: 'Inspect payload' },
  participants: {
    resetAffinities: 'Reset affinities', expandAll: 'Expand all', collapseAll: 'Collapse all', person: 'Person', free: 'Free', neutral: 'Neutral', modelDefault: 'Model default', unnamed: 'Unnamed', dragToReorder: 'Drag to reorder', expandParticipant: 'Expand participant', collapseParticipant: 'Collapse participant', endpointBadge: 'EP', removeParticipant: 'Remove participant', verbosity: 'Verbosity', namePlaceholder: 'Name', fantasyName: 'Fantasy name', randomName: 'Random name', userManualTurn: 'User (manual turn)', noModelsAvailable: 'No models available', customEndpointTitle: (endpoint, st) => `Custom endpoint: ${endpoint}${st ? ` (${st.state})` : ''}`, configureCustomEndpoint: 'Configure custom endpoint', participantMood: 'Participant mood', relationalAffinity: 'Relational affinity', relationTitle: name => `Relation with ${name}`, affinity: 'affinity', conflict: 'conflict', lockTitle: 'Lock relation', age: 'Age', ageTitle: label => `Age: ${label}`, educationTitle: 'Education', moderatorRole: 'Moderator role', alwaysInterveneTitle: 'Always intervene', alwaysIntervene: 'Always intervene', moderatorDynamicAffinityTitle: 'Dynamic affinity for moderator', moderatorDynamicAffinity: 'Moderator dynamic affinity', moderatorFactCheckTitle: 'Fact checking', moderatorFactCheck: 'Fact checking', enforceTopicTitle: 'Enforce topic', enforceTopic: 'Enforce topic', editConstraint: 'Edit constraint', removeConstraint: 'Remove constraint', addConstraint: 'Add constraint', addConstraintButton: 'Add constraint', addParticipant: 'Add participant' },
  app: {
    noLocalModels: 'No local models found', removeParticipantTitle: 'Remove participant', removeParticipantMessage: label => `Remove ${label}?`, removeConstraintHistoryTitle: 'Remove saved constraint', removeConstraintHistoryMessage: current => `Remove "${current}" from history?`, resetAffinitiesTitle: 'Reset affinities', resetAffinitiesMessage: 'Reset all affinities?', resetAffinitiesConfirm: 'Reset', invalidJsonFile: 'Invalid JSON file', clearSettingsMessage: 'This operation is irreversible and resets the local configuration.', debateTitle: 'AI Debate', connectionConnecting: 'Connecting', connectionConnected: count => `Connected (${count})`, connectionUnreachable: 'Unreachable', modelsCount: count => `${count} models`, collapseSettings: 'Collapse settings', expandSettings: 'Expand settings', language: 'Language', endpoint: 'Endpoint', connecting: 'Connecting...', connect: 'Connect', dynamicAffinityTitleOn: 'Dynamic affinity on', dynamicAffinityTitleOff: 'Dynamic affinity off', dynamicAffinity: 'Dynamic affinity', coolingTitle: 'Cooling factor', cooling: 'Cooling', perRoundSummaryOn: 'Per-round summary on', perRoundSummaryOff: 'Per-message mode', perRoundSummary: 'Per-round summary', perMessageSummary: 'Per-message summary', summarizeAttachments: 'Summarize attachments', accumulateSummaryOn: threshold => `Accumulate summary on (${threshold} KB)`, accumulateSummaryOff: threshold => `Accumulate summary off (${threshold} KB)`, accumulateSummaryCompact: threshold => `Accumulate (${threshold} KB)`, accumulateSummary: 'Accumulate summary', summaryModel: 'Summary model', round: 'Rounds', timeout: 'Timeout', seconds: 'sec', lastK: 'Last K', debugOn: 'Debug on', debugOff: 'Debug off', debugLabel: 'Debug', contextSummary: 'Context summary', contextEstimate: (chars, tokens) => `${chars} chars / ~${tokens} tokens`, copySummary: 'Copy summary', inspectSummaryPayload: 'Inspect summary payload', noSummary: 'No summary yet', summaryProcessing: 'Summary processing...', generatingConclusion: title => `Generating ${title}...`, conclusions: 'Conclusions', customConclusionPlaceholder: 'Write a custom conclusion prompt...', standardConclusionPlaceholder: 'Additional guidance...', standardConclusionTitle: 'Additional guidance', generate: 'Generate', backToBottom: 'Back to bottom', docTruncated: 'Document truncated', topicQueued: 'Queued', topicContinue: 'Continue', topicInitial: 'Topic', removeHistoryItem: 'Remove item', addGlobalConstraint: 'Add global constraint', attachDocument: 'Attach document', queueCurrentText: 'Queue current text', intervene: 'Intervene', allParticipantsNeedModel: 'All participants need a model', ollamaUnreachable: 'Backend unreachable', resumeWithInterjection: 'Resume with variation', resumePingPong: 'Resume', continueWithPrompt: 'Continue with prompt', continue: 'Continue', resetButton: 'Reset' },
}
