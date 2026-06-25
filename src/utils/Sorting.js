function messageSortKey(msg) {
  if (typeof msg?.seq === 'number') return msg.seq
  return (msg?.turn ?? 0) + 0.001
}

function conclusionSortKey(conclusion) {
  if (typeof conclusion?.seq === 'number') return conclusion.seq
  return Infinity
}

export function buildOrderedItems(messages = [], conclusions = [], options = {}) {
  const {
    includeMessageIndex = false,
    includeConclusionIndex = false,
  } = options

  const items = []

  messages.forEach((msg, idx) => {
    const item = { kind: 'msg', sortKey: messageSortKey(msg), msg }
    if (includeMessageIndex) item.idx = idx
    items.push(item)
  })

  conclusions.forEach((c, idx) => {
    const item = { kind: 'conclusion', sortKey: conclusionSortKey(c), c }
    if (includeConclusionIndex) item.cidx = idx
    items.push(item)
  })

  items.sort((a, b) => a.sortKey - b.sortKey)
  return items
}
