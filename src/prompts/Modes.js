import { UI_OPTION_LABELS } from '../i18n/UiStrings'

// Debate modes describe the shared purpose of the exchange. They are kept
// separate from moods because a mode applies to the whole table, while a mood
// remains an individual participant behaviour.
//
// Everything about a mode lives in a single block below:
//   instruction — injected in every participant turn (see DebateModePrompt.js);
//                 null means "no specialized procedure" (Free mode).
//   conclusion  — steers summaries, verdicts and the other closing outputs.
// Prompt text is written as separate clauses joined with a single space, so a
// long instruction can be edited line by line without producing one unreadable
// string. Order matters: it is the order shown in the mode selector.

const text = (...parts) => parts.join(' ')

const MODE_DEFINITIONS = [
  {
    id: 'free',
    labelEn: 'Free',
    label: UI_OPTION_LABELS.modes.free,
    emoji: '🗣️',
    instruction: null,
    conclusion: text(
      'Summarize the discussion neutrally and preserve important nuance without forcing a decision.',
    ),
  },
  {
    id: 'brainstorm',
    labelEn: 'Brainstorm',
    label: UI_OPTION_LABELS.modes.brainstorm,
    emoji: '💡',
    instruction: text(
      'On every turn, generate or extend several useful possibilities before judging them.',
      'Prioritize breadth, novelty, and combinations;',
      'defer rejection until ideas have been made concrete.',
    ),
    conclusion: text(
      'Preserve the breadth of ideas, group related possibilities,',
      'and defer ranking or rejection unless the discussion explicitly established criteria.',
    ),
  },
  {
    id: 'fact_check',
    labelEn: 'Fact Check',
    label: UI_OPTION_LABELS.modes.factCheck,
    emoji: '🔎',
    instruction: text(
      'On every turn, identify the factual claims that matter,',
      'classify each as verified, unsupported, disputed, or uncertain,',
      'and state what evidence or source would resolve it.',
      'Never present an unsupported claim as established.',
    ),
    conclusion: text(
      'Classify material claims as verified, unsupported, disputed, or uncertain.',
      'Identify evidence gaps and do not turn unresolved facts into a confident verdict.',
    ),
  },
  {
    id: 'design_review',
    labelEn: 'Design Review',
    label: UI_OPTION_LABELS.modes.designReview,
    emoji: '🧩',
    instruction: text(
      'On every turn, review the proposal against its goals and constraints.',
      'Name at least one concrete strength or risk, explain the trade-off,',
      'and propose a specific improvement or test.',
    ),
    conclusion: text(
      'Organize the result around goals, constraints, strengths, risks, trade-offs,',
      'and concrete improvements or tests.',
    ),
  },
  {
    id: 'decision',
    labelEn: 'Decision',
    label: UI_OPTION_LABELS.modes.decision,
    emoji: '⚖️',
    instruction: text(
      'On every turn, move the group toward a decision:',
      'compare options against explicit criteria, expose trade-offs,',
      'and state which option you recommend or the precise uncertainty blocking a recommendation.',
    ),
    conclusion: text(
      'Compare the options against explicit criteria and give a recommendation when justified.',
      'If not, name the precise uncertainty or missing evidence blocking the decision.',
    ),
  },
  {
    id: 'negotiation',
    labelEn: 'Negotiation',
    label: UI_OPTION_LABELS.modes.negotiation,
    emoji: '🤝',
    instruction: text(
      'On every turn, distinguish positions from underlying interests,',
      'identify what could be conceded,',
      'and propose a concrete mutually acceptable trade-off.',
      'Do not argue only to win.',
    ),
    conclusion: text(
      'Separate positions, underlying interests, concessions, agreements, and unresolved terms.',
      'Prefer a workable trade-off over declaring a winner.',
    ),
  },
  {
    id: 'red_team',
    labelEn: 'Red Team',
    label: UI_OPTION_LABELS.modes.redTeam,
    emoji: '🛡️',
    instruction: text(
      'On every turn, attack the strongest current proposal rather than a weak version of it.',
      'Expose assumptions, vulnerabilities, counterexamples, and failure modes,',
      'and distinguish fatal flaws from fixable weaknesses.',
    ),
    conclusion: text(
      'Focus on the strongest proposal’s assumptions, vulnerabilities, counterexamples, and failure modes.',
      'Distinguish fatal flaws from fixable weaknesses and include mitigations where available.',
    ),
  },
  {
    id: 'socratic',
    labelEn: 'Socratic',
    label: UI_OPTION_LABELS.modes.socratic,
    emoji: '🏛️',
    instruction: text(
      'On every turn, lead with precise questions that test definitions, assumptions, evidence,',
      'implications, and contradictions.',
      'Do not rush to assert a conclusion when a question would reveal more.',
    ),
    conclusion: text(
      'Prioritize the key unanswered questions, definitions, assumptions, and evidence gaps.',
      'Keep any conclusion provisional when a question remains decisive.',
    ),
  },
  {
    id: 'peer_review',
    labelEn: 'Peer Review',
    label: UI_OPTION_LABELS.modes.peerReview,
    emoji: '📚',
    instruction: text(
      'On every turn, give rigorous but constructive peer review:',
      'assess reasoning, evidence, clarity, completeness, and reproducibility,',
      'then identify specific revisions rather than offering vague approval or rejection.',
    ),
    conclusion: text(
      'Separate strengths, major issues, minor issues, evidence quality, reproducibility,',
      'and specific revisions.',
      'Do not reduce the review to vague approval or rejection.',
    ),
  },
  {
    id: 'consensus',
    labelEn: 'Consensus',
    label: UI_OPTION_LABELS.modes.consensus,
    emoji: '🌐',
    instruction: text(
      'On every turn, explicitly separate agreements from unresolved disagreements,',
      'reconcile compatible views,',
      'and propose the smallest precise common position the group could accept.',
      'Never manufacture agreement.',
    ),
    conclusion: text(
      'Clearly separate genuine agreements, unresolved disagreements,',
      'and the smallest precise common position.',
      'Never manufacture consensus.',
    ),
  },
  {
    id: 'role_play',
    labelEn: 'Role Play',
    label: UI_OPTION_LABELS.modes.rolePlay,
    emoji: '🎭',
    instruction: text(
      'Treat the debate as a shared role-playing scene.',
      'Every turn must advance the fiction through an in-character action, dialogue, decision,',
      'or concrete reaction.',
      'Never replace participation with critique or meta-debate;',
      'defer world adjudication and narration to the moderator acting as Master / Narrator.',
    ),
    conclusion: text(
      'Stay inside the fiction: recap consequential events, current character/world state,',
      'established facts, open situations, and possible narrative hooks.',
      'Do not judge the moderator, analyze the debate from outside the fiction,',
      'or invent outcomes not established in the scene.',
    ),
  },
]

export const DEBATE_MODES = MODE_DEFINITIONS.map(({ id, label, labelEn, emoji, instruction }) => ({
  id, label, labelEn, emoji, instruction,
}))

export const DEBATE_MODE_CONCLUSION_INSTRUCTIONS = Object.fromEntries(
  MODE_DEFINITIONS.map(mode => [mode.id, mode.conclusion]),
)

export const DEFAULT_DEBATE_MODE = 'free'
export const DEBATE_MODE_OPTIONS = DEBATE_MODES.map(mode => ({ value: mode.id, label: mode.label, emoji: mode.emoji }))

export function normalizeDebateMode(value) {
  return DEBATE_MODES.some(mode => mode.id === value) ? value : DEFAULT_DEBATE_MODE
}
