import { imageCache, makeThumbnail, normalizeImage } from '../services/Images'

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
 * What `source` points at, normalized: an attached image by name, or the image
 * (or page screenshot) behind a URL, downloaded once per debate.
 * Throws with a readable message when there is nothing to show.
 */
export async function resolveImage(source, {
  attachments = [],
  fetchImage = defaultFetchImage,
  normalize = normalizeImage,
  cache = imageCache,
} = {}) {
  const attached = matchAttachment(imageAttachments(attachments), source)
  if (attached) return { kind: 'attachment', source: attached.name, image: attached.image }
  if (!isHttpUrl(source)) throw new Error(`"${source}" is neither an attached image nor an http(s) URL.`)
  let entry = cache.get(source)
  if (!entry) {
    const fetched = await fetchImage(source)
    entry = { kind: fetched.kind === 'page' ? 'page' : 'image', image: await normalize(fetched.blob) }
    cache.set(source, entry)
  }
  return { kind: entry.kind, source, image: entry.image }
}

/**
 * Thumbnails already drawn, per image. Keyed on the image object itself, so
 * the attachments' state is never written to and a cleared cache takes its
 * thumbnails with it.
 */
const thumbnails = new WeakMap()

/** The full-size image for the chat's lightbox, as a data URL. */
export async function loadFullImage(source, options) {
  const { kind, image } = await resolveImage(String(source || '').trim(), options)
  return { kind, src: `data:${image.mime};base64,${image.base64}`, width: image.width, height: image.height }
}

/**
 * Runs the tool call.
 *
 * Returns `{ content, images, caption, pill }` when there is something to look
 * at — `images` being base64 strings for the model, `pill` what the chat shows
 * on the call's pill (a thumbnail and the source to reopen) — and plain text
 * otherwise, so a failure reads like any other tool result and the model is
 * told what it can ask for instead.
 */
export async function viewImage(args = {}, {
  attachments = [],
  fetchImage = defaultFetchImage,
  normalize = normalizeImage,
  thumbnail = makeThumbnail,
  cache = imageCache,
} = {}) {
  const images = imageAttachments(attachments)
  const source = String(args?.source ?? args?.url ?? args?.name ?? '').trim()
  if (!source) return failure('No source given: pass the name of an attached image or an http(s) URL.', images)
  if (!matchAttachment(images, source) && !isHttpUrl(source)) {
    return failure(`"${source}" is neither an attached image nor an http(s) URL.`, images)
  }

  let resolved
  try {
    resolved = await resolveImage(source, { attachments, fetchImage, normalize, cache })
  } catch (error) {
    // A failed download says nothing about what the image shows.
    return failure(`Could not load the image at ${source}: ${error?.message || 'unknown error'}. Nothing was viewed: do not describe it.`, images)
  }

  const { kind, image } = resolved
  // A thumbnail that cannot be drawn costs the pill its picture, never the
  // model its image.
  if (!thumbnails.has(image)) {
    let drawn = null
    try { drawn = await thumbnail(image) } catch { /* no picture on the pill */ }
    thumbnails.set(image, drawn)
  }
  const note = kind === 'page'
    ? 'This is a screenshot of the web page as it renders, not the page text; use fetch_url to read its text. The screenshot follows in the next message.'
    : 'The image follows in the next message.'
  return {
    content: JSON.stringify({ source: resolved.source, kind, width: image.width, height: image.height, note }),
    images: [image.base64],
    caption: kind === 'attachment'
      ? `[view_image: attachment "${resolved.source}"]`
      : `[view_image: ${kind === 'page' ? 'screenshot of' : 'image at'} ${resolved.source}]`,
    pill: { thumbnail: thumbnails.get(image), imageSource: resolved.source, imageKind: kind },
  }
}
