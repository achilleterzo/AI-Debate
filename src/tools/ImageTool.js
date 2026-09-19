import { imageCache, normalizeImage } from '../services/Images'

/**
 * Looking at an image, for models that can.
 *
 * The tool result itself is text — tool messages carry no image on most
 * backends — and the picture travels in the message right after it, which
 * every vision model reads (see Stream.js). The tool is only offered to a
 * participant whose model reports the `vision` capability.
 */
export const VIEW_IMAGE_TOOL = {
  type: 'function',
  function: {
    name: 'view_image',
    description: 'Look at an image. `source` is the file name of an image attached to this debate, or an absolute http(s) URL: of an image, or of a web page, which is then shown as a screenshot of how it renders. The image is delivered to you right after the tool result.',
    parameters: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'File name of an attached image, as listed in the attachment index, or an absolute http(s) URL of an image or a web page.' },
      },
      required: ['source'],
    },
  },
  constraints: [
    'MANDATORY: Describe or reason about an image only after viewing it with view_image. Never infer what an image shows from its file name, its URL or the text around it.',
  ],
}

export function imageAttachments(docs = []) {
  return (Array.isArray(docs) ? docs : []).filter(doc => doc?.kind === 'image' && doc.image?.base64)
}

function matchAttachment(images, requested) {
  const wanted = String(requested || '').trim().toLowerCase()
  if (!wanted) return null
  return images.find(doc => String(doc.name || '').toLowerCase() === wanted)
    ?? images.find(doc => String(doc.name || '').toLowerCase().includes(wanted))
    ?? null
}

function isHttpUrl(value) {
  try { return /^https?:$/.test(new URL(value).protocol) } catch { return false }
}

/**
 * The image behind `url`, as a Blob.
 *
 * The desktop app goes through its own browser session, which also turns a web
 * page into a screenshot. The web build can only use a plain fetch, which the
 * browser refuses for any image served without CORS headers.
 */
export async function defaultFetchImage(url) {
  const desktop = globalThis.window?.desktop
  if (desktop?.webFetchImage) {
    const result = await desktop.webFetchImage({ url })
    return { kind: result.kind, blob: new Blob([result.data], { type: result.mime }) }
  }
  let response
  try {
    response = await fetch(url, { mode: 'cors', signal: AbortSignal.timeout(20_000) })
  } catch (error) {
    throw new Error(`${error?.message || 'download failed'} (the web version can only open images served with CORS; the desktop app can open any image)`)
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const blob = await response.blob()
  if (!blob.type.startsWith('image/')) {
    throw new Error(`Not an image (${blob.type || 'unknown type'}); screenshots of web pages need the desktop app`)
  }
  return { kind: 'image', blob }
}

function failure(error, images) {
  return JSON.stringify({
    error,
    imageAttachments: images.map(doc => doc.name),
  })
}

/**
 * Runs the tool call.
 *
 * Returns `{ content, images }` when there is something to look at — `images`
 * being base64 strings — and plain text otherwise, so a failure reads like any
 * other tool result and the model is told what it can ask for instead.
 */
export async function viewImage(args = {}, {
  attachments = [],
  fetchImage = defaultFetchImage,
  normalize = normalizeImage,
  cache = imageCache,
} = {}) {
  const images = imageAttachments(attachments)
  const source = String(args?.source ?? args?.url ?? args?.name ?? '').trim()
  if (!source) return failure('No source given: pass the name of an attached image or an http(s) URL.', images)

  const attached = matchAttachment(images, source)
  if (attached) {
    const { base64, width, height } = attached.image
    return {
      content: JSON.stringify({ source: attached.name, kind: 'attachment', width, height, note: 'The image follows in the next message.' }),
      images: [base64],
      caption: `[view_image: attachment "${attached.name}"]`,
    }
  }

  if (!isHttpUrl(source)) {
    return failure(`"${source}" is neither an attached image nor an http(s) URL.`, images)
  }

  try {
    let entry = cache.get(source)
    if (!entry) {
      const fetched = await fetchImage(source)
      entry = { kind: fetched.kind === 'page' ? 'page' : 'image', ...(await normalize(fetched.blob)) }
      cache.set(source, entry)
    }
    return {
      content: JSON.stringify({
        source,
        kind: entry.kind,
        width: entry.width,
        height: entry.height,
        note: entry.kind === 'page'
          ? 'This is a screenshot of the web page as it renders, not the page text; use fetch_url to read its text. The screenshot follows in the next message.'
          : 'The image follows in the next message.',
      }),
      images: [entry.base64],
      caption: `[view_image: ${entry.kind === 'page' ? 'screenshot of' : 'image at'} ${source}]`,
    }
  } catch (error) {
    // A failed download says nothing about what the image shows.
    return failure(`Could not load the image at ${source}: ${error?.message || 'unknown error'}. Nothing was viewed: do not describe it.`, images)
  }
}
