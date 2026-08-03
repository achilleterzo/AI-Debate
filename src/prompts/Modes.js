import { UI_OPTION_LABELS } from '../i18n/UiStrings'

// Debate modes describe the shared purpose of the exchange. They are kept
// separate from moods because a mode applies to the whole table, while a mood
// remains an individual participant behaviour.
export const DEBATE_MODES = [
  { id: 'free', label: UI_OPTION_LABELS.modes.free, labelEn: 'Free', emoji: '🗣️', instruction: null },
  { id: 'brainstorm', label: UI_OPTION_LABELS.modes.brainstorm, labelEn: 'Brainstorm', emoji: '💡', instruction: 'On every turn, generate or extend several useful possibilities before judging them. Prioritize breadth, novelty, and combinations; defer rejection until ideas have been made concrete.' },
  { id: 'fact_check', label: UI_OPTION_LABELS.modes.factCheck, labelEn: 'Fact Check', emoji: '🔎', instruction: 'On every turn, identify the factual claims that matter, classify each as verified, unsupported, disputed, or uncertain, and state what evidence or source would resolve it. Never present an unsupported claim as established.' },
  { id: 'design_review', label: UI_OPTION_LABELS.modes.designReview, labelEn: 'Design Review', emoji: '🧩', instruction: 'On every turn, review the proposal against its goals and constraints. Name at least one concrete strength or risk, explain the trade-off, and propose a specific improvement or test.' },
  { id: 'decision', label: UI_OPTION_LABELS.modes.decision, labelEn: 'Decision', emoji: '⚖️', instruction: 'On every turn, move the group toward a decision: compare options against explicit criteria, expose trade-offs, and state which option you recommend or the precise uncertainty blocking a recommendation.' },
  { id: 'negotiation', label: UI_OPTION_LABELS.modes.negotiation, labelEn: 'Negotiation', emoji: '🤝', instruction: 'On every turn, distinguish positions from underlying interests, identify what could be conceded, and propose a concrete mutually acceptable trade-off. Do not argue only to win.' },
  { id: 'red_team', label: UI_OPTION_LABELS.modes.redTeam, labelEn: 'Red Team', emoji: '🛡️', instruction: 'On every turn, attack the strongest current proposal rather than a weak version of it. Expose assumptions, vulnerabilities, counterexamples, and failure modes, and distinguish fatal flaws from fixable weaknesses.' },
  { id: 'socratic', label: UI_OPTION_LABELS.modes.socratic, labelEn: 'Socratic', emoji: '🏛️', instruction: 'On every turn, lead with precise questions that test definitions, assumptions, evidence, implications, and contradictions. Do not rush to assert a conclusion when a question would reveal more.' },
  { id: 'peer_review', label: UI_OPTION_LABELS.modes.peerReview, labelEn: 'Peer Review', emoji: '📚', instruction: 'On every turn, give rigorous but constructive peer review: assess reasoning, evidence, clarity, completeness, and reproducibility, then identify specific revisions rather than offering vague approval or rejection.' },
  { id: 'consensus', label: UI_OPTION_LABELS.modes.consensus, labelEn: 'Consensus', emoji: '🌐', instruction: 'On every turn, explicitly separate agreements from unresolved disagreements, reconcile compatible views, and propose the smallest precise common position the group could accept. Never manufacture agreement.' },
  { id: 'role_play', label: UI_OPTION_LABELS.modes.rolePlay, labelEn: 'Role Play', emoji: '🎭', instruction: 'Treat the debate as a shared role-playing scene. Every turn must advance the fiction through an in-character action, dialogue, decision, or concrete reaction. Never replace participation with critique or meta-debate; defer world adjudication and narration to the moderator acting as Master / Narrator.' },
]

export const DEBATE_MODE_CONCLUSION_INSTRUCTIONS = {
  free: 'Summarize the discussion neutrally and preserve important nuance without forcing a decision.',
  brainstorm: 'Preserve the breadth of ideas, group related possibilities, and defer ranking or rejection unless the discussion explicitly established criteria.',
  fact_check: 'Classify material claims as verified, unsupported, disputed, or uncertain. Identify evidence gaps and do not turn unresolved facts into a confident verdict.',
  design_review: 'Organize the result around goals, constraints, strengths, risks, trade-offs, and concrete improvements or tests.',
  decision: 'Compare the options against explicit criteria and give a recommendation when justified. If not, name the precise uncertainty or missing evidence blocking the decision.',
  negotiation: 'Separate positions, underlying interests, concessions, agreements, and unresolved terms. Prefer a workable trade-off over declaring a winner.',
  red_team: 'Focus on the strongest proposal’s assumptions, vulnerabilities, counterexamples, and failure modes. Distinguish fatal flaws from fixable weaknesses and include mitigations where available.',
  socratic: 'Prioritize the key unanswered questions, definitions, assumptions, and evidence gaps. Keep any conclusion provisional when a question remains decisive.',
  peer_review: 'Separate strengths, major issues, minor issues, evidence quality, reproducibility, and specific revisions. Do not reduce the review to vague approval or rejection.',
  consensus: 'Clearly separate genuine agreements, unresolved disagreements, and the smallest precise common position. Never manufacture consensus.',
  role_play: 'Stay inside the fiction: recap consequential events, current character/world state, established facts, open situations, and possible narrative hooks. Do not judge the moderator, analyze the debate from outside the fiction, or invent outcomes not established in the scene.',
}

export const DEFAULT_DEBATE_MODE = 'free'
export const DEBATE_MODE_OPTIONS = DEBATE_MODES.map(mode => ({ value: mode.id, label: mode.label, emoji: mode.emoji }))

export function normalizeDebateMode(value) {
  return DEBATE_MODES.some(mode => mode.id === value) ? value : DEFAULT_DEBATE_MODE
}
