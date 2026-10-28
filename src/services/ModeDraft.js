import { MODE_EMOJI_GROUPS } from '../dataset/ModeEmojis'

/**
 * Asking a model to write a debate mode from a description.
 *
 * The name is written for the person (in the interface language); the two
 * purposes are written for models, in English, in the same register as the
 * built-in modes, because that is the language the rest of the prompt is in.
 */

export const MAX_MODE_NAME_CHARS = 40
export const MAX_MODE_TEXT_CHARS = 900
export const MAX_MODE_DESCRIPTION_CHARS = 1500

export function buildModeDraftSystemPrompt({ languageNamed }) {
  return [
    'You design debate modes for a multi-participant AI debate application.',
    `Write the "name" value in ${languageNamed}. Write "instruction" and "conclusion" in English.`,
    'Answer with a single JSON object with the keys "name", "emoji", "instruction" and "conclusion", and nothing else: no prose, no markdown fences, no commentary.',
    'Never reveal reasoning or meta-commentary.',
  ].join(' ')
}

export function buildModeDraftPrompt({ description, languageNamed, existingNames = [] }) {
  return [
    'A debate mode is the shared purpose of a whole debate. It applies to every participant on every turn.',
    '',
    'Design a new mode from this description:',
    String(description ?? '').trim().slice(0, MAX_MODE_DESCRIPTION_CHARS),
    '',
    'Return these fields:',
    `- "name": a short name in ${languageNamed}, at most 4 words.`,
    '- "emoji": exactly one emoji that represents the mode.',
    '- "instruction": the rule every participant follows on every turn, in English. Start with "On every turn," and state concretely what each contribution must do, and what to avoid. Two to four sentences, imperative, no mention of this application.',
    '- "conclusion": how summaries, verdicts and the other closing outputs must treat a debate held in this mode, in English. Two to three sentences, imperative.',
    existingNames.length ? `Do not reuse these names: ${existingNames.join(', ')}.` : '',
  ].filter(line => line !== '').join('\n')
}

const KNOWN_EMOJIS = new Set(MODE_EMOJI_GROUPS.flat())
const EMOJI_PATTERN = /\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}|\p{Emoji_Modifier})*/u

function stripFences(raw) {
  return String(raw ?? '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
}

const clean = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max).trim()

/**
 * The draft out of the model's answer, or null when it has no usable purpose.
 * An emoji is kept when it really is one; anything else is left empty so the
 * mode falls back to the neutral default icon.
 */
export function parseModeDraft(raw) {
  const text = stripFences(raw)
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  let parsed
  try {
    parsed = JSON.parse(text.slice(start, end + 1))
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  const instruction = clean(parsed.instruction, MAX_MODE_TEXT_CHARS)
  if (!instruction) return null
  const emojiText = String(parsed.emoji ?? '').trim()
  const emoji = KNOWN_EMOJIS.has(emojiText) ? emojiText : (emojiText.match(EMOJI_PATTERN)?.[0] ?? '')
  return {
    name: clean(parsed.name, MAX_MODE_NAME_CHARS),
    emoji,
    instruction,
    conclusion: clean(parsed.conclusion, MAX_MODE_TEXT_CHARS),
  }
}
