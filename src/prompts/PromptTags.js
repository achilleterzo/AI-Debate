/**
 * Every tag the app wraps prompt material in.
 *
 * They are delimiters we write, never prose a participant would produce, so a
 * model echoing one back is leaking scaffolding — either the empty tag or, as
 * happens with the reasoning ones, a whole block of internal monologue dressed
 * as an answer. Keeping the list in one place lets the emitting side and the
 * cleaning side stay in agreement; a test walks a built prompt and fails if a
 * tag ever appears here without being listed.
 */
export const PROMPT_SECTION_TAGS = [
  'active_topic',
  'attached_context',
  'character_context',
  'character_profile',
  'constraints',
  'context_discipline',
  'conversation_context',
  'debate_mode',
  'fetched_sources',
  'identity',
  'moderation_tool_requirement',
  'moderation_trigger',
  'moderator_authority',
  'moderator_instructions',
  'participants',
  'reasoning_focus',
  'relational_affinity',
  'response_style',
  'role_play',
  'source_priority',
  'tool_protocol',
  'topic_directives',
  'topic_sources',
  'turn_request',
]

const TAG_GROUP = PROMPT_SECTION_TAGS.join('|')

// A closed block goes entirely: what a model puts inside one of our delimiters
// is its own scaffolding talk, not the contribution it was asked for.
const BLOCK_RE = new RegExp(`<(${TAG_GROUP})>[\\s\\S]*?<\\/\\1>`, 'gi')

// Whatever is left — an unmatched open or close — is a stray delimiter.
const LOOSE_TAG_RE = new RegExp(`<\\/?(?:${TAG_GROUP})>`, 'gi')

export function stripPromptScaffolding(text) {
  return String(text ?? '').replace(BLOCK_RE, '').replace(LOOSE_TAG_RE, '')
}
