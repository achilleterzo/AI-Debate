export const CONCLUSION_TYPES = [
    {
      id: 'summary', label: 'Summary', labelEn: 'Summary', color: '#4a9eff',
      prompt: (ctxJson) => `Provide a concise, neutral summary of the debate.\n\nUse this JSON input:\n${ctxJson}`,
    },
    {
      id: 'considerations', label: 'Considerations', labelEn: 'Considerations', color: '#8b5cf6',
      prompt: (ctxJson) => `Provide high-value considerations and synthesis points that help understand the debate quality and implications.\n\nUse this JSON input:\n${ctxJson}`,
    },
    {
      id: 'contradictions', label: 'Contradictions', labelEn: 'Contradictions', color: '#ef4444',
      prompt: (ctxJson) => `Identify explicit contradictions, self-inconsistencies, and unresolved tensions between participants.\n\nUse this JSON input:\n${ctxJson}`,
    },
    {
      id: 'blindspot', label: 'Blindspots', labelEn: 'Blindspots', color: '#a78bfa',
      prompt: (ctxJson) => `Identify the main blindspots: what participants are missing, overlooking, or assuming without examination.\n\nUse this JSON input:\n${ctxJson}`,
    },
    {
      id: 'verdict', label: 'Verdict', labelEn: 'Verdict', color: '#f59e0b',
      prompt: (ctxJson) => `Act as an impartial judge. Deliver a verdict about which arguments are strongest and why.\n\nUse this JSON input:\n${ctxJson}`,
    },
    {
      id: 'next_steps', label: 'Next steps', labelEn: 'Next steps', color: '#10b981',
      prompt: (ctxJson) => `Propose concrete and prioritized next steps that are actionable and realistic.\n\nUse this JSON input:\n${ctxJson}`,
    },
    {
      id: 'custom', label: 'Prompt', labelEn: 'Custom prompt', color: '#22d3ee',
      prompt: (ctxJson, customPrompt) => {
        const c = (customPrompt || '').trim()
        if (!c) return ''
        return `${c}\n\nUse this JSON input:\n${ctxJson}`
      },
    },
  ]
