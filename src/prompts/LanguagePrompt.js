import { UI_LANGUAGE_OPTIONS } from '../i18n/UiStrings'

/**
 * Sentinel for the "Other (specify)…" entry of the output language picker. It
 * is never stored: choosing it opens the free-text modal, and what lands in
 * `uiLang` is the typed text itself. Anything outside the fixed list is
 * therefore a custom language, which is all `isCustomOutputLanguage` checks.
 */
export const OUTPUT_LANG_CUSTOM = '__custom__'

export function isCustomOutputLanguage(uiLang, languages = UI_LANGUAGE_OPTIONS) {
  const value = String(uiLang ?? '').trim()
  return !!value && !languages.some(language => language.code === value)
}

/**
 * Names the debate output language for a model.
 *
 * A language taken from the list is quoted with its ISO code; a custom one is
 * free text with no code to quote, so it is named on its own rather than
 * dragging a nonsensical "language code: Napoletano" into every prompt.
 */
export function outputLanguagePhrase(uiLang, languages = UI_LANGUAGE_OPTIONS) {
  const entry = languages.find(language => language.code === uiLang)
  return entry ? `${entry.label} (language code: ${entry.code})` : String(uiLang ?? '').trim()
}

export function outputLanguageLabel(uiLang, languages = UI_LANGUAGE_OPTIONS) {
  return languages.find(language => language.code === uiLang)?.label ?? String(uiLang ?? '').trim()
}

/**
 * Resolves the thinking language into a label the model can act on.
 *
 * A custom entry is free text, so it has no language code: the prompt then
 * names the language only, which is what a model needs anyway for anything
 * outside the fixed list (dialects, historical or invented languages).
 */
function resolveReasoningLanguage({ actor, uiLang, languages, reasoningLangCustom }) {
  if (actor.reasoningLang === reasoningLangCustom) {
    const label = String(actor.reasoningLangCustom || '').trim()
    return label ? { label, code: '' } : { label: '', code: '' }
  }

  const code = actor.reasoningLang && actor.reasoningLang !== uiLang ? actor.reasoningLang : ''
  if (!code) return { label: '', code: '' }
  return { label: languages.find(language => language.code === code)?.label ?? code, code }
}

export function buildLanguagePrompt({ actor, uiLang, languages, reasoningLangCustom }) {
  const languageLabel = outputLanguageLabel(uiLang, languages)
  const languageNamed = outputLanguagePhrase(uiLang, languages)
  const reasoning = resolveReasoningLanguage({ actor, uiLang, languages, reasoningLangCustom })
  const named = reasoning.code ? `${reasoning.label} (language code: ${reasoning.code})` : reasoning.label
  const skipTranslation = !!(reasoning.label && actor.reasoningLangSkipTranslation)

  if (!reasoning.label) {
    return `You are ${actor.name || actor.tag}. Respond in ${languageNamed}.`
  }

  return skipTranslation
    ? `You are ${actor.name || actor.tag}. Do all internal reasoning and deliberation in ${named}, and write your final visible response in ${reasoning.label} as well — do not translate it into ${languageLabel}.`
    : `You are ${actor.name || actor.tag}. Do all internal reasoning and deliberation in ${named}. Your final visible response, however, must be written only in ${languageNamed}, as a faithful translation of that reasoning — never leave any part of the visible response in ${reasoning.label} unless it is identical to ${languageLabel}.`
}
