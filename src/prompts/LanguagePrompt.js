function constraintText(entry) {
  return typeof entry === 'string' ? entry : String(entry?.text ?? '')
}

function detectReasoningLangFromConstraints(constraints, languages) {
  const text = (constraints || []).map(constraintText).filter(Boolean).join(' ').toLowerCase()
  if (!text) return ''
  const match = languages.find(language => text.includes(language.label.toLowerCase()))
  return match?.code ?? ''
}

export function buildLanguagePrompt({ actor, uiLang, languages, reasoningLangFromConstraint, globalConstraints }) {
  const languageLabel = languages.find(language => language.code === uiLang)?.label ?? uiLang
  const requestedReasoningLang = actor.reasoningLang === reasoningLangFromConstraint
    ? detectReasoningLangFromConstraints([...(actor.constraints || []), ...(globalConstraints || [])], languages)
    : actor.reasoningLang
  const reasoningLangCode = requestedReasoningLang && requestedReasoningLang !== uiLang ? requestedReasoningLang : ''
  const reasoningLangLabel = reasoningLangCode
    ? (languages.find(language => language.code === reasoningLangCode)?.label ?? reasoningLangCode)
    : ''
  const skipTranslation = !!(reasoningLangCode && actor.reasoningLangSkipTranslation)

  const identityBlock = reasoningLangLabel
    ? (skipTranslation
        ? `You are ${actor.name || actor.tag}. Do all internal reasoning and deliberation in ${reasoningLangLabel} (language code: ${reasoningLangCode}), and write your final visible response in ${reasoningLangLabel} as well — do not translate it into ${languageLabel}.`
        : `You are ${actor.name || actor.tag}. Do all internal reasoning and deliberation in ${reasoningLangLabel} (language code: ${reasoningLangCode}). Your final visible response, however, must be written only in ${languageLabel} (language code: ${uiLang}), as a faithful translation of that reasoning — never leave any part of the visible response in ${reasoningLangLabel} unless it is identical to ${languageLabel}.`)
    : `You are ${actor.name || actor.tag}. Respond in ${languageLabel} (language code: ${uiLang}).`

  return identityBlock
}
