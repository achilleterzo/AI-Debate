export function buildTopicPromptBlocks({ history, attachedDocs }) {
  const topicDirectives = history
    .filter(m => (m.role === 'topic' || m.role === 'interjection') && m.content?.trim())
    .map((m, index) => {
      if (m.role === 'topic') return `${index + 1}. Topic baseline: ${m.content.trim()}`
      return `${index + 1}. Topic update / clarification: ${m.content.trim()}`
    })
    .join('\n')

  const activeTopicMessage = [...history]
    .reverse()
    .find(m => (m.role === 'interjection' || m.role === 'topic') && m.content?.trim())

  const activeTopicLabel = activeTopicMessage?.role === 'interjection'
    ? 'Current topic correction / active focus'
    : 'Current topic'

  const activeTopicBlock = activeTopicMessage?.content?.trim()
    ? `${activeTopicLabel}:\n${activeTopicMessage.content.trim()}\n\nThis is the active focus of the debate and has priority over earlier tangents, side debates, inferred subtopics, or participant framings. If there is any conflict between the active topic and the direction of the conversation, follow the active topic.`
    : ''

  const activeTopicUrls = activeTopicMessage?.content
    ? [...new Set((String(activeTopicMessage.content).match(/https?:\/\/[^\s"'<>)]+/g) || []))]
    : []
  const sourcePriorityBlock = activeTopicUrls.length > 0
    ? `Primary source URLs in the active topic:\n${activeTopicUrls.map(url => `- ${url}`).join('\n')}\n\nUse these source URLs as your first factual reference. If they already provide enough information, do not perform additional web search. Search the web only to verify missing details or add necessary context beyond the provided source.`
    : ''

  const topicDirectiveBlock = topicDirectives
    ? `Topic directives history:\n${topicDirectives}\n\nTreat topic and topic updates as authoritative steering instructions from outside the debate flow, not as conversational turns by any participant or by the moderator.`
    : ''

  const docsBlock = attachedDocs.length > 0
    ? `\n\nAttached context documents:\n${attachedDocs.map(d => `## ${d.name}\n${d.content}`).join('\n\n')}`
    : ''

  return { topicDirectiveBlock, activeTopicBlock, sourcePriorityBlock, docsBlock }
}
