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
    emoji: '🗣️',
    instruction: null,
    conclusion: text(
      'Summarize the discussion neutrally and preserve important nuance without forcing a decision.',
    ),
  },
  {
    id: 'brainstorm',
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
    id: 'investigation',
    emoji: '🕵️',
    instruction: text(
      'On every turn, advance the investigation by separating observations from inferences,',
      'connecting clues, testing inconsistencies, and keeping multiple plausible hypotheses open.',
      'State what evidence supports or weakens each hypothesis and identify the next useful lead,',
      'question, source, or verification step.',
      'Do not treat suspicion, missing evidence, or correlation as proof.',
    ),
    conclusion: text(
      'Reconstruct the evidence trail and separate established facts, inferences, hypotheses,',
      'contradictions, and unresolved questions.',
      'Rank plausible explanations by evidential support and identify the next investigative steps.',
      'Do not present an accusation or unresolved hypothesis as a finding.',
    ),
  },
  {
    id: 'design_review',
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

/**
 * The mode's English name, for the places that are not the interface.
 *
 * The interface has translated labels of its own (`UI_STRINGS.modes`), which is
 * why the label was taken off the mode definitions. What was missed is that the
 * prompts and the exports also name the mode, and they fell back to the raw id:
 * a participant was told the mode was `RED_TEAM`, a conclusion was handed
 * `debate_mode_label: "peer_review"`, and an export header read `decision`.
 * That is our storage key shown to a model and to a reader.
 */
const titleCase = id => id
  .split('_')
  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
  .join(' ')

export const DEBATE_MODES = MODE_DEFINITIONS.map(({ id, emoji, instruction }) => ({
  id, emoji, instruction, label: titleCase(id),
}))

export const DEBATE_MODE_CONCLUSION_INSTRUCTIONS = Object.fromEntries(
  MODE_DEFINITIONS.map(mode => [mode.id, mode.conclusion]),
)

export const DEFAULT_DEBATE_MODE = 'free'
export const DEBATE_MODE_OPTIONS = DEBATE_MODES.map(mode => ({ value: mode.id, emoji: mode.emoji }))

export function normalizeDebateMode(value) {
  return DEBATE_MODES.some(mode => mode.id === value) ? value : DEFAULT_DEBATE_MODE
}

/** The English name of whichever mode an id resolves to. */
export function debateModeLabel(value) {
  return titleCase(normalizeDebateMode(value))
}
