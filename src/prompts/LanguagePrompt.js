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
  const languageLabel = languages.find(language => language.code === uiLang)?.label ?? uiLang
  const reasoning = resolveReasoningLanguage({ actor, uiLang, languages, reasoningLangCustom })
  const named = reasoning.code ? `${reasoning.label} (language code: ${reasoning.code})` : reasoning.label
  const skipTranslation = !!(reasoning.label && actor.reasoningLangSkipTranslation)

  if (!reasoning.label) {
    return `You are ${actor.name || actor.tag}. Respond in ${languageLabel} (language code: ${uiLang}).`
  }

  return skipTranslation
    ? `You are ${actor.name || actor.tag}. Do all internal reasoning and deliberation in ${named}, and write your final visible response in ${reasoning.label} as well — do not translate it into ${languageLabel}.`
    : `You are ${actor.name || actor.tag}. Do all internal reasoning and deliberation in ${named}. Your final visible response, however, must be written only in ${languageLabel} (language code: ${uiLang}), as a faithful translation of that reasoning — never leave any part of the visible response in ${reasoning.label} unless it is identical to ${languageLabel}.`
}
