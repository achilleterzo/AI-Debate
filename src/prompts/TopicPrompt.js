/**
 * Below this, an attachment is simply included: the round-trip through the
 * tool would cost more context than the document itself.
 */
const ATTACHMENT_INLINE_CHARS = 2000

/** How much of a long attachment the index shows, so the tool call is informed. */
const ATTACHMENT_PREVIEW_CHARS = 700

/**
 * The attached documents as the participants receive them.
 *
 * Everything used to be pasted in whole, in every participant's prompt, on
 * every turn: an 80 KB document was paid for once per turn per participant,
 * and at the context budget it was the transcript that got cut to make room
 * for it. With `read_attachment` available the long ones travel as an index —
 * name, size, and enough of the opening to know what it is — and the full text
 * is one tool call away. Short ones are still included outright, and so is
 * everything when the tool is not available: without it the prompt is the only
 * way the document can be read at all.
 */
function buildDocsBlock(attachedDocs, attachmentToolAvailable, attachmentsSummarized) {
  if (attachedDocs.length === 0) return ''

  const rendered = attachedDocs.map(doc => {
    const content = String(doc.content ?? '')
    if (!attachmentToolAvailable || content.length <= ATTACHMENT_INLINE_CHARS) {
      return `## ${doc.name}\n${content}`
    }
    const opening = attachmentsSummarized
      ? `Analytical summary:\n${content}`
      : `Opening of the document:\n${content.slice(0, ATTACHMENT_PREVIEW_CHARS)}…`
    return `## ${doc.name}\n(${content.length} characters${attachmentsSummarized ? ', summarized' : ''})\n${opening}`
  })

  const indexed = attachmentToolAvailable
    && attachedDocs.some(doc => String(doc.content ?? '').length > ATTACHMENT_INLINE_CHARS)
  const note = indexed
    ? '\n\nThe documents above marked with a character count are not reproduced in full here. Read one with the read_attachment tool before quoting it or stating what it says; the summary or opening shown is not the document.'
    : ''

  return `\n\nAttached context documents:\n${rendered.join('\n\n')}${note}`
}

export function buildTopicPromptBlocks({ history, attachedDocs, attachmentToolAvailable = false, attachmentsSummarized = false }) {
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

  const docsBlock = buildDocsBlock(attachedDocs, attachmentToolAvailable, attachmentsSummarized)

  return { topicDirectiveBlock, activeTopicBlock, sourcePriorityBlock, docsBlock }
}
