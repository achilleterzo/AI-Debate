export function topicToSlug(topic, maxLength = 48) {
  return (topic || '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, maxLength)
    .replace(/-+$/, '')
}
