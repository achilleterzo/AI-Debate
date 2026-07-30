// Keeps letters, numbers and combining marks from any script (Unicode-aware,
// so CJK, Arabic, Devanagari, Thai, Cyrillic, etc. survive instead of being
// wiped out) and drops everything else — punctuation and symbols, which
// already covers the characters unsafe in filenames on Windows/macOS/Linux.
const NON_SLUG_CHARS = /[^\p{L}\p{N}\p{M}\s]/gu

export function topicToSlug(topic, maxLength = 48) {
  return (topic || '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '')
    .replace(NON_SLUG_CHARS, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, maxLength)
    .replace(/-+$/, '')
}
