/**
 * Guidance is stored per conclusion type.
 *
 * One shared field meant a note written to strengthen a Summary was also sent
 * with a Verdict and with the Blindspots, so the only safe thing to write in it
 * was something generic — which is the opposite of what it is for. Each type
 * now keeps its own text, and the custom type keeps using its own prompt field.
 */
export function standardConclusionTypeIds() {
  return CONCLUSION_TYPES.filter(type => type.id !== 'custom').map(type => type.id)
}

/**
 * Guidance read back from settings or a snapshot, as a per-type map.
 *
 * A stored string is what every version before this wrote, and it was applied
 * to whichever type was generated: it is carried onto every type so nothing a
 * user wrote quietly stops being sent.
 */
export function normalizeStandardConclusionPrompts(value) {
  const ids = standardConclusionTypeIds()
  if (typeof value === 'string') {
    return Object.fromEntries(ids.map(id => [id, value]))
  }
  if (!value || typeof value !== 'object') return Object.fromEntries(ids.map(id => [id, '']))
  return Object.fromEntries(ids.map(id => [id, typeof value[id] === 'string' ? value[id] : '']))
}

/**
 * The name of a conclusion type as the interface shows it.
 *
 * The definitions carry `labelEn` because the request tells the model what it
 * is being asked for ("respond only with the requested verdict"), and that
 * sentence is English whatever the debate speaks. They used to carry a second,
 * identical `label` that every button rendered — so the row of conclusion
 * buttons stayed in English in all eight translations. The displayed name comes
 * from the locale now, and falls back to the English one where a translation
 * has not been written.
 */
export function conclusionTypeLabel(strings, type) {
  const id = typeof type === 'string' ? type : type?.id
  const translated = strings?.conclusionTypes?.[id]
  if (translated) return translated
  if (typeof type === 'object' && type?.labelEn) return type.labelEn
  return CONCLUSION_TYPES.find(entry => entry.id === id)?.labelEn ?? String(id ?? '')
}

export const CONCLUSION_TYPES = [
    {
      id: 'summary', labelEn: 'Summary', color: '#4a9eff',
      prompt: (ctxJson) => `Provide a concise, neutral summary of the debate.\n\nUse this JSON input:\n${ctxJson}`,
    },
    {
      id: 'considerations', labelEn: 'Considerations', color: '#8b5cf6',
      prompt: (ctxJson) => `Provide high-value considerations and synthesis points that help understand the debate quality and implications.\n\nUse this JSON input:\n${ctxJson}`,
    },
    {
      id: 'contradictions', labelEn: 'Contradictions', color: '#ef4444',
      prompt: (ctxJson) => `Identify explicit contradictions, self-inconsistencies, and unresolved tensions between participants.\n\nUse this JSON input:\n${ctxJson}`,
    },
    {
      id: 'blindspot', labelEn: 'Blindspots', color: '#a78bfa',
      prompt: (ctxJson) => `Identify the main blindspots: what participants are missing, overlooking, or assuming without examination.\n\nUse this JSON input:\n${ctxJson}`,
    },
    {
      id: 'verdict', labelEn: 'Verdict', color: '#f59e0b',
      prompt: (ctxJson) => `Act as an impartial judge. Deliver a verdict about which arguments are strongest and why.\n\nUse this JSON input:\n${ctxJson}`,
    },
    {
      id: 'next_steps', labelEn: 'Next steps', color: '#10b981',
      prompt: (ctxJson) => `Propose concrete and prioritized next steps that are actionable and realistic.\n\nUse this JSON input:\n${ctxJson}`,
    },
    {
      // Named for the model, not for the button: the request says "respond
      // only with the requested custom prompt". The button reads "Prompt".
      id: 'custom', labelEn: 'Custom prompt', color: '#22d3ee',
      prompt: (ctxJson, customPrompt) => {
        const c = (customPrompt || '').trim()
        if (!c) return ''
        return `${c}\n\nUse this JSON input:\n${ctxJson}`
      },
    },
  ]
