/**
 * "Magic wand" suggestions.
 *
 * Builds the prompts that ask a model for ready-to-use text, and turns the
 * answer back into a list. Kept free of React and of the HTTP layer so the
 * prompt shape and the (deliberately forgiving) parsing can be tested directly.
 */

export const SUGGESTION_MODE = {
  /** Prompts the user could send to continue or steer the running debate. */
  STEER: 'steer',
  /** Extra guidance for the conclusion, inferred from how the debate went. */
  CONCLUSION: 'conclusion',
  /** A participant persona, driven by the selected character type. */
  PARTICIPANT: 'participant',
  /** A ground rule for the whole table, written into the global constraints. */
  GLOBAL_RULE: 'globalRule',
  /** A behaviour rule for one participant, written into its own constraints. */
  CONSTRAINT: 'constraint',
}

/** Each participant wand is independent, so its mode carries the row index. */
export function participantMode(index) {
  return `${SUGGESTION_MODE.PARTICIPANT}:${index}`
}

export function isParticipantMode(mode) {
  return String(mode ?? '').startsWith(`${SUGGESTION_MODE.PARTICIPANT}:`)
}

export function constraintMode(index) {
  return `${SUGGESTION_MODE.CONSTRAINT}:${index}`
}

export function isConstraintMode(mode) {
  return String(mode ?? '').startsWith(`${SUGGESTION_MODE.CONSTRAINT}:`)
}

export function modeIndex(mode) {
  const index = Number(String(mode ?? '').split(':')[1])
  return Number.isInteger(index) ? index : -1
}

export const DEFAULT_SUGGESTION_COUNT = 4

export const MAX_CONSTRAINT_CHARS = 1000
const MAX_SUGGESTION_CHARS = 220
const MAX_ATTACHMENT_CONTEXT_CHARS = 8000

export function buildSuggestionSystemPrompt({ languageNamed }) {
  return [
    'You produce short, ready-to-use text for a debate application.',
    `Write every suggestion in ${languageNamed}.`,
    'Answer with a JSON array of strings and nothing else: no prose, no markdown fences, no numbering, no keys.',
    'Never reveal reasoning or meta-commentary.',
  ].join(' ')
}

export function buildSuggestionPrompt({
  mode,
  debateMode = 'free',
  debateModeLabel = debateMode,
  debateModeInstruction = '',
  topic = '',
  conversation = '',
  summary = '',
  participants = [],
  attachedDocs = [],
  languageNamed = '',
  count = DEFAULT_SUGGESTION_COUNT,
}) {
  const roster = participants
    .map(participant => participant?.name || participant?.tag)
    .filter(Boolean)
    .join(', ')

  const context = [
    topic.trim() ? `Debate topic:\n${topic.trim()}` : '',
    roster ? `Participants at the table (context only; suggestions must address the debate as a whole): ${roster}` : '',
    attachedDocs.length > 0
      ? `Attached documents (use these as source material for the shared topic):\n${attachedDocs.map(document => `## ${document.name}\n${String(document.content || '').slice(0, MAX_ATTACHMENT_CONTEXT_CHARS)}`).join('\n\n').slice(0, MAX_ATTACHMENT_CONTEXT_CHARS)}`
      : '',
    summary.trim() ? `Summary so far:\n${summary.trim()}` : '',
    conversation.trim() ? `Recent exchanges:\n${conversation.trim()}` : '',
  ].filter(Boolean).join('\n\n')

  const hasTopicMaterial = topic.trim() || attachedDocs.length > 0
  const task = mode === SUGGESTION_MODE.CONCLUSION
    ? [
        `Analyse how this debate actually went and propose ${count} distinct pieces of additional guidance for the analyst who will write its conclusion.`,
        'Each one must point at something the debate itself raises: an unresolved disagreement, a claim left unverified, an angle nobody covered, a shift of position worth noting, or an imbalance between participants.',
        'Write each as a direct instruction to the analyst. Do not write the conclusion itself.',
      ].join(' ')
    : hasTopicMaterial
      ? [
          `Propose ${count} distinct refinements or alternative phrasings of the current topic prompt, grounded in the prompt and any attached documents.`,
          'Preserve the user’s core intent while making each proposal clearer, more specific, or more useful to the whole debate. Do not answer the topic, write the debate response, or invent a different subject.',
          debateMode === 'role_play'
            ? 'In Role Play, phrase the proposals as shared scene premises, goals, complications, or situations that let all participants act inside the fiction; never suggest meta-analysis of the Master’s narration.'
            : 'These are general topic instructions for every participant, not instructions for one character. Do not make a participant the topic, ask the user to add or redefine a participant, or address one participant by name unless the prompt explicitly requires it.',
        ].join(' ')
      : [
          `Propose ${count} distinct prompts the user could send next to continue or steer this debate.`,
          'Vary the intent: deepen the strongest open thread, challenge an unexamined assumption, request concrete evidence, or redirect toward a neglected angle.',
          'These are general steering instructions for every participant, not instructions for one character. Write each as a message the user would actually send to the debate as a whole. Do not make a participant the topic, ask the user to add or redefine a participant, or address one participant by name unless the active topic explicitly requires it. Do not answer the debate yourself.',
          debateMode === 'role_play'
            ? 'In Role Play, suggest shared scene developments, choices, complications, or questions that let all participants act inside the fiction; never suggest meta-analysis of the Master’s narration.'
            : 'Prefer additions to the shared direction, constraints, questions, or evidence requested from the whole table rather than personal traits or assignments for one participant.',
        ].join(' ')

  return [
    `Shared debate mode: ${debateModeLabel} (${debateMode}).${debateModeInstruction ? ` ${debateModeInstruction}` : ''}`,
    context || 'The debate has just started and has no exchanges yet.',
    task,
    `Each suggestion must be a single sentence, under ${MAX_SUGGESTION_CHARS} characters, self-contained and immediately usable.`,
    outputLanguageLine(languageNamed, 'suggestion'),
    `Return exactly ${count} strings in a JSON array.`,
  ].filter(Boolean).join('\n\n')
}

export function buildParticipantSystemPrompt({ languageNamed }) {
  return [
    'You design debate participants for a debate application.',
    `Write every human-readable value in ${languageNamed}, except language codes.`,
    'Answer with a JSON array of objects and nothing else: no prose, no markdown fences, no commentary.',
    'Never reveal reasoning or meta-commentary.',
  ].join(' ')
}

/**
 * The character type drives the whole persona, so it is stated first and the
 * task is phrased differently for real people than for invented ones.
 */
export function buildParticipantPrompt({
  characterTypeLabel,
  characterType = null,
  debateMode = 'free',
  debateModeLabel = debateMode,
  debateModeInstruction = '',
  isModerator = false,
  moderatorMode = 'containment',
  topic = '',
  others = [],
  count = 3,
  languageNamed = '',
  languageOptions = [],
  moodOptions = [],
}) {
  const roster = others
    .map(other => {
      const traits = (other.traits || []).filter(Boolean).join('; ')
      return `- ${other.name || other.tag}${traits ? ` — ${traits}` : ''}`
    })
    .join('\n')

  const identityTask = characterType
    ? `Each entry must be a real, recognisable ${characterTypeLabel}. Use the person's actual name and give traits that reflect their documented positions, expertise and rhetorical style.`
    : 'Each entry must be an invented but believable person. Give a plausible full name and traits that define a clear, specific point of view.'

  const languageHint = languageOptions.length > 0
    ? `"reasoningLang": a language code from [${languageOptions.join(', ')}] ONLY when the persona would genuinely think in that language (for example a historical figure tied to a language); otherwise null.`
    : '"reasoningLang": null.'

  const moodHint = moodOptions.length > 0
    ? `"mood": the debating attitude that best fits this persona, one of [${moodOptions.join(', ')}].`
    : '"mood": null.'

  const moderatorTask = isModerator
    ? `This participant is marked as the debate moderator, using the ${moderatorMode} moderation style. Generate traits useful for moderating: impartial facilitation, turn and topic management, clarification of claims, constructive intervention, and enforcement of debate rules. Do not characterize this participant primarily as an advocate for a substantive position.`
    : ''
  const candidateTask = isModerator
    ? 'Prioritize candidates with strong facilitation judgment, calm communication, and the ability to manage disagreement. Never duplicate an existing participant.'
    : 'Pick candidates that add friction and coverage the table is missing: a different discipline, generation, or stance. Never duplicate an existing participant.'

  return [
    `Shared debate mode: ${debateModeLabel} (${debateMode}).${debateModeInstruction ? ` ${debateModeInstruction}` : ''}`,
    moderatorTask,
    topic.trim() ? `Debate topic:\n${topic.trim()}` : 'No debate topic has been set yet.',
    roster ? `Participants already at the table:\n${roster}` : 'No other participants yet.',
    `Propose ${count} distinct candidates for a new participant. ${identityTask}`,
    candidateTask,
    [
      'Each object must have exactly these keys:',
      '"name": the participant name, no title or honorific.',
      `"traits": 2 or 3 instruction sentences describing stance, expertise and rhetorical habits. Each trait must be at most ${MAX_CONSTRAINT_CHARS} characters; if the characterization needs more space, use additional trait entries instead of truncating it. Address them to the participant directly, in the second person.`,
      '"ageGroup": one of 0 (child), 1 (teenager), 2 (adult), 3 (mature), 4 (elder).',
      '"educationLevel": one of "street", "primary", "proficient", "academic", "expert", or null when unremarkable.',
      `"responseLength": one of "short", "medium", "detailed", or null (Free). Prefer "${isModerator ? 'null (Free) for this moderator' : 'short'}"; choose a longer value only when the persona genuinely needs more room to explain nuanced reasoning.`,
      moodHint,
      '"moodIntensity": how strongly that attitude shows, one of 0 (low), 1 (light), 2 (balanced), 3 (strong), 4 (extreme).',
      languageHint,
    ].join('\n'),
    outputLanguageLine(languageNamed, 'human-readable value', 'leaving the JSON keys and any language code untouched'),
    `Return exactly ${count} objects in a JSON array.`,
  ].filter(Boolean).join('\n\n')
}

/**
 * Names the output language inside the user prompt, not only in the system
 * one. Every instruction the wand sends is written in English, and a model
 * asked for second-person rules will happily copy the language of the request
 * it is reading — naming the target language again, at the end where the last
 * instruction carries most weight, is what keeps the answer in it.
 */
function outputLanguageLine(languageNamed, subject = 'entry', caveat = '') {
  return languageNamed
    ? `Write every ${subject} in ${languageNamed}${caveat ? `, ${caveat}` : ''}. These instructions are in English for convenience; that has no bearing on the language of your answer.`
    : ''
}

function existingRulesBlock(existing, label) {
  const listed = existing.map(entry => String(entry ?? '').trim()).filter(Boolean)
  return listed.length > 0
    ? `${label}\n${listed.map(entry => `- ${entry}`).join('\n')}\n\nEvery proposal must add something these do not already cover. Never restate one, never contradict one.`
    : ''
}

/**
 * Shared ground rules for the whole table.
 *
 * They are derived from the mode and from what the user said the debate is
 * for, so they constrain how everyone argues rather than what any single
 * participant defends — that is what the personas are for. Used both by the
 * setup wizard and by the wand on the global constraints, which write to the
 * same list and would otherwise pull the debate in two directions.
 */
export function buildGlobalRulesPrompt({
  debateMode = 'free',
  debateModeLabel = debateMode,
  debateModeInstruction = '',
  purpose = '',
  existing = [],
  verificationTools = [],
  languageNamed = '',
  count = 3,
}) {
  // Naming the tools is what turns "be rigorous" into a rule that changes what
  // a turn does. Only the ones actually enabled are named: a rule that sends
  // the table to a tool nobody has is an instruction to invent the result.
  const verificationTask = verificationTools.length > 0
    ? [
        `The participants can call these tools during the debate: ${verificationTools.join(', ')}.`,
        'Spend exactly one of the rules on verification: it must require checking disputed factual claims with those tools and arguing from what the tool actually returned — never from an assumed result, a remembered figure, or a source nobody opened.',
      ].join(' ')
    : ''

  return [
    `Shared debate mode: ${debateModeLabel} (${debateMode}).${debateModeInstruction ? ` ${debateModeInstruction}` : ''}`,
    purpose.trim()
      ? `What this debate is for:\n${purpose.trim()}`
      : 'The user has not described a purpose: derive the rules from the debate mode alone.',
    existingRulesBlock(existing, 'Ground rules already in force:'),
    `Write ${count} shared ground rules that keep the whole table working toward that purpose.`,
    'Each rule applies to every participant: how to argue here, what to prioritise, what to avoid, what makes a contribution useful in this debate. Never name a participant, never assign anyone a position, never state the conclusion the debate should reach.',
    verificationTask,
    'Write each rule as a direct instruction to the participants.',
    `Each rule must be a single sentence, under ${MAX_SUGGESTION_CHARS} characters, self-contained and immediately usable.`,
    outputLanguageLine(languageNamed, 'rule'),
    `Return exactly ${count} strings in a JSON array.`,
  ].filter(Boolean).join('\n\n')
}

/**
 * Behaviour rules for one participant.
 *
 * The selectors above the constraint list already say who this participant is;
 * a rule that repeats them costs a line of every prompt and changes nothing.
 * So the configuration goes in as context to build on, not as material to
 * paraphrase, and the rules the row already carries go in to be avoided.
 */
export function buildParticipantConstraintPrompt({
  name = '',
  tag = '',
  isModerator = false,
  moderatorMode = 'containment',
  profile = [],
  existing = [],
  others = [],
  debateMode = 'free',
  debateModeLabel = debateMode,
  debateModeInstruction = '',
  topic = '',
  languageNamed = '',
  count = DEFAULT_SUGGESTION_COUNT,
}) {
  const who = name ? `${name} (${tag})` : tag || 'this participant'
  const roster = others
    .map(other => `- ${other.name || other.tag}${other.isModerator ? ' (moderator)' : ''}`)
    .join('\n')

  const roleTask = isModerator
    ? `This participant is the debate moderator, running the ${moderatorMode} style. The rules must sharpen how it facilitates — when to step in, what to let pass, how to phrase a ruling — and must never turn it into an advocate for a substantive position.`
    : 'The rules must sharpen how this participant argues: what it goes after, what evidence it demands, what it refuses to concede, the habits that make it recognisable across turns.'

  return [
    `Shared debate mode: ${debateModeLabel} (${debateMode}).${debateModeInstruction ? ` ${debateModeInstruction}` : ''}`,
    topic.trim() ? `Debate topic:\n${topic.trim()}` : 'No debate topic has been set yet.',
    `You are writing behaviour rules for ${who}, and for nobody else at the table.`,
    profile.length > 0
      ? `How ${who} is already configured:\n${profile.map(entry => `- ${entry}`).join('\n')}\n\nThe application already applies all of it. Do not restate it: build on it, and propose only what those settings cannot express on their own.`
      : `Nothing has been configured for ${who} yet, so the rules have to do the defining.`,
    existingRulesBlock(existing, `Rules ${who} already carries:`),
    roster ? `Others at the table (context only; never write a rule for them):\n${roster}` : '',
    `Propose ${count} distinct rules. ${roleTask}`,
    // No English exemplar of the second-person form here: a model shown one
    // copies it, and the rule comes back in English however the debate reads.
    `Address each one to the participant directly, in the second person. Never name ${who} in the third person, never assign the position it must defend, and never state how the debate should end.`,
    `Each rule must be a single sentence, under ${MAX_SUGGESTION_CHARS} characters, self-contained and immediately usable.`,
    outputLanguageLine(languageNamed, 'rule'),
    `Return exactly ${count} strings in a JSON array.`,
  ].filter(Boolean).join('\n\n')
}

const AGE_ALIASES = { child: 0, teenager: 1, teen: 1, adult: 2, mature: 3, elder: 4, elderly: 4, senior: 4 }
const EDUCATION_VALUES = ['street', 'primary', 'proficient', 'academic', 'expert']
const RESPONSE_LENGTH_VALUES = ['short', 'medium', 'detailed']

function normalizeAgeGroup(value) {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 4) return value
  const text = String(value ?? '').trim().toLowerCase()
  if (/^[0-4]$/.test(text)) return Number(text)
  for (const [alias, index] of Object.entries(AGE_ALIASES)) {
    if (text.includes(alias)) return index
  }
  return null
}

const INTENSITY_ALIASES = { low: 0, light: 1, balanced: 2, medium: 2, strong: 3, extreme: 4 }

function normalizeMood(value, allowed) {
  const text = String(value ?? '').trim().toLowerCase()
  if (!text || !allowed.length) return null
  return allowed.find(mood => text === mood) ?? allowed.find(mood => text.includes(mood)) ?? null
}

function normalizeIntensity(value) {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 4) return value
  const text = String(value ?? '').trim().toLowerCase()
  if (/^[0-4]$/.test(text)) return Number(text)
  for (const [alias, level] of Object.entries(INTENSITY_ALIASES)) {
    if (text.includes(alias)) return level
  }
  return null
}

function normalizeEducation(value) {
  const text = String(value ?? '').trim().toLowerCase()
  return EDUCATION_VALUES.find(level => text === level || text.includes(level)) ?? null
}

function normalizeLang(value, allowed) {
  const text = String(value ?? '').trim().toLowerCase()
  if (!text || text === 'null' || text === 'none') return ''
  return allowed.includes(text) ? text : ''
}

/**
 * Turns the answer into participant drafts, keeping only values the existing
 * selectors can actually represent. Anything unrecognised becomes null so the
 * current setting is left untouched rather than overwritten with junk.
 */
export function parseParticipantDrafts(raw, { max = 3, languageOptions = [], moodOptions = [], defaultResponseLength = 'short' } = {}) {
  const text = stripFences(raw)
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start === -1 || end <= start) return []

  let parsed
  try {
    parsed = JSON.parse(text.slice(start, end + 1))
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []

  const drafts = []
  const seen = new Set()
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object') continue
    const name = cleanEntry(entry.name).slice(0, 60)
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    const traits = (Array.isArray(entry.traits) ? entry.traits : [entry.traits])
      .flatMap(trait => splitConstraintText(cleanEntry(trait), MAX_CONSTRAINT_CHARS))
      .filter(trait => trait.length >= 8)
      .slice(0, 6)

    drafts.push({
      name,
      traits,
      ageGroup: normalizeAgeGroup(entry.ageGroup),
      educationLevel: normalizeEducation(entry.educationLevel),
      responseLength: normalizeResponseLength(entry.responseLength, defaultResponseLength),
      mood: normalizeMood(entry.mood, moodOptions),
      moodIntensity: normalizeIntensity(entry.moodIntensity),
      reasoningLang: normalizeLang(entry.reasoningLang, languageOptions),
    })
    if (drafts.length >= max) break
  }
  return drafts
}

function normalizeResponseLength(value, fallback = 'short') {
  if (value == null) return fallback
  const text = String(value).trim().toLowerCase()
  if (text === 'free' || text === 'null') return fallback
  return RESPONSE_LENGTH_VALUES.includes(text) ? text : fallback
}

/** Keeps generated constraints usable even when a model ignores the limit. */
export function splitConstraintText(value, maxLength = MAX_CONSTRAINT_CHARS) {
  const text = String(value ?? '').trim()
  if (!text || text.length <= maxLength) return text ? [text] : []

  const chunks = []
  let remaining = text
  while (remaining.length > maxLength) {
    let cut = remaining.lastIndexOf(' ', maxLength)
    if (cut < Math.floor(maxLength * 0.6)) cut = maxLength
    chunks.push(remaining.slice(0, cut).trim())
    remaining = remaining.slice(cut).trim()
  }
  if (remaining) chunks.push(remaining)
  return chunks
}

function stripFences(raw) {
  return String(raw ?? '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
}

function cleanEntry(value) {
  return String(value ?? '')
    .trim()
    // Drop list markers the model may add despite the JSON instruction.
    .replace(/^[-*•]\s+/, '')
    .replace(/^\d+[.)]\s+/, '')
    .replace(/^["'«]|["'»]$/g, '')
    .trim()
}

/**
 * Parses the model answer into a suggestion list.
 *
 * A strict JSON array is the requested shape, but small local models routinely
 * answer with a numbered or bulleted list instead, so that is accepted too
 * rather than dropping an otherwise perfectly usable answer.
 */
export function parseSuggestions(raw, { max = DEFAULT_SUGGESTION_COUNT } = {}) {
  const text = stripFences(raw)
  if (!text) return []

  const collected = []

  const jsonStart = text.indexOf('[')
  const jsonEnd = text.lastIndexOf(']')
  if (jsonStart !== -1 && jsonEnd > jsonStart) {
    try {
      const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1))
      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          if (typeof entry === 'string') collected.push(cleanEntry(entry))
          else if (entry && typeof entry === 'object') {
            // Tolerate [{ "suggestion": "..." }] and similar wrappers.
            const value = entry.text ?? entry.suggestion ?? entry.prompt ?? entry.value
            if (typeof value === 'string') collected.push(cleanEntry(value))
          }
        }
      }
    } catch {
      // Fall through to the line-based reading below.
    }
  }

  if (collected.length === 0) {
    for (const line of text.split('\n')) {
      const cleaned = cleanEntry(line)
      // Keep only lines that look like an actual suggestion, not headings.
      if (cleaned.length < 8) continue
      if (/^[a-z\s]{0,30}:$/i.test(cleaned)) continue
      collected.push(cleaned)
    }
  }

  const seen = new Set()
  const unique = []
  for (const entry of collected) {
    const value = entry.slice(0, MAX_SUGGESTION_CHARS).trim()
    if (!value) continue
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(value)
    if (unique.length >= max) break
  }
  return unique
}
