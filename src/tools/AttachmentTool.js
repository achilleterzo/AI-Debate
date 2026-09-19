import { Web } from '../services/Web'

/**
 * The documents attached to the debate, on demand.
 *
 * They used to travel one way only: every attachment was pasted whole into
 * every participant's system prompt, on every turn. A single long document was
 * therefore paid for by each participant of each round, and once the summariser
 * was on nobody could reach the source text at all — the summary was all there
 * was. This tool is the other direction: the prompt carries the index, and a
 * participant that needs the actual wording asks for it.
 *
 * Blocks are sized on the same page-block setting `fetch_url` uses, so one
 * knob bounds every large tool result the debate carries.
 */
export const READ_ATTACHMENT_TOOL = {
  type: 'function',
  function: {
    name: 'read_attachment',
    description: 'Read a document attached to this debate. Call it without a name to list the attachments; call it with a name to read that document. Long documents are returned one block at a time: the reply states how many blocks there are and you can request the next one.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'File name of the attachment to read, as listed in the attachment index. Omit to list what is attached.' },
        page: { type: 'integer', description: 'Which block of a long document to return, starting at 1. Defaults to 1.' },
      },
      required: [],
    },
  },
  constraints: [
    'MANDATORY: When the wording of an attached document matters, invoke read_attachment through the structured tool interface and argue from what it returned. Never quote, paraphrase, or characterise an attachment you have only seen indexed or summarised.',
  ],
}

/** How much of a document a single call returns, before the block footer. */
function blockChars() {
  return Math.max(2000, Web.config.pageBlockChars)
}

function matchDocument(docs, requested) {
  const wanted = String(requested || '').trim().toLowerCase()
  if (!wanted) return null
  return docs.find(doc => String(doc?.name || '').toLowerCase() === wanted)
    // A model that reads `report.pdf` in the index and asks for `report` is
    // reaching for the right document, not a missing one.
    ?? docs.find(doc => String(doc?.name || '').toLowerCase().includes(wanted))
    ?? null
}

/**
 * Runs the tool call. Always answers with something readable: an attachment
 * that cannot be found has to say so, and say what is there instead, or the
 * model invents the contents it was asking for.
 */
export function readAttachment(docs = [], args = {}) {
  const available = (Array.isArray(docs) ? docs : []).filter(doc => String(doc?.content || '').trim())
  const index = available.map(doc => (doc.kind === 'image'
    ? { name: doc.name, type: 'image' }
    : { name: doc.name, characters: String(doc.content).length }))

  if (available.length === 0) {
    return JSON.stringify({ attachments: [], note: 'No documents are attached to this debate.' })
  }

  const requested = String(args?.name || '').trim()
  if (!requested) return JSON.stringify({ attachments: index })

  const doc = matchDocument(available, requested)
  if (!doc) {
    return JSON.stringify({ error: `No attachment named "${requested}".`, attachments: index })
  }

  if (doc.kind === 'image') {
    return JSON.stringify({ name: doc.name, type: 'image', note: 'This attachment is an image and has no text to read. Look at it with the view_image tool, if you have it.' })
  }

  const content = String(doc.content)
  const size = blockChars()
  const blocks = Math.max(1, Math.ceil(content.length / size))
  const page = Math.min(blocks, Math.max(1, Math.floor(Number(args?.page) || 1)))
  const text = content.slice((page - 1) * size, page * size)

  return JSON.stringify({
    name: doc.name,
    block: page,
    blocks,
    characters: content.length,
    content: text,
    ...(page < blocks ? { more: `Call read_attachment with name "${doc.name}" and page ${page + 1} for the next block.` } : {}),
  })
}
