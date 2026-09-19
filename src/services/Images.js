/**
 * Images as vision models receive them: base64, in a format every backend
 * decodes, and no larger than the models actually look at.
 *
 * Vision encoders downscale anything bigger themselves, so sending a 4000px
 * photo spends megabytes of request body — on every tool round of the turn —
 * for detail the model never sees. The browser decodes whatever it can show
 * (WebP, AVIF, GIF, SVG, BMP …) and re-encodes to PNG or JPEG, the two formats
 * every vision backend accepts.
 */

export const IMAGE_MAX_EDGE = 1568
export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif', 'svg']
const JPEG_QUALITY = 0.88
/** Above this a PNG (screenshot, diagram) is re-encoded as JPEG after all. */
const PNG_MAX_BYTES = 1_500_000

/**
 * Images already downloaded and normalized in this debate, by URL: several
 * participants looking at the same picture download it once.
 */
export const imageCache = new Map()

export function clearImageCache() {
  imageCache.clear()
}

export function isImageFileName(name) {
  const ext = String(name || '').split('.').pop().toLowerCase()
  return IMAGE_EXTENSIONS.includes(ext)
}

/** `width`×`height` scaled down, never up, so the longer edge fits `maxEdge`. */
export function fitWithin(width, height, maxEdge = IMAGE_MAX_EDGE) {
  const w = Math.max(1, Math.round(Number(width) || 1))
  const h = Math.max(1, Math.round(Number(height) || 1))
  const scale = Math.min(1, maxEdge / Math.max(w, h))
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) }
}

/**
 * PNG keeps text and line art sharp, JPEG keeps photos small. Sources that
 * are usually drawn (PNG, GIF, SVG, BMP) start as PNG; everything else as JPEG.
 */
export function preferredOutputType(sourceType) {
  return /png|gif|svg|bmp/i.test(String(sourceType || '')) ? 'image/png' : 'image/jpeg'
}

async function decode(blob) {
  // createImageBitmap does not take SVG; an <img> does.
  if (!/svg/i.test(blob.type) && typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(blob) } catch { /* fall back to <img> */ }
  }
  const url = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.decoding = 'async'
    image.src = url
    await image.decode()
    return image
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function encode(canvas, type) {
  const blob = await new Promise((resolve, reject) => canvas.toBlob(
    result => (result ? resolve(result) : reject(new Error('Image encoding failed'))),
    type,
    type === 'image/jpeg' ? JPEG_QUALITY : undefined,
  ))
  return blob
}

export function bytesToBase64(bytes) {
  let binary = ''
  const chunk = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(offset, offset + chunk))
  }
  return btoa(binary)
}

/**
 * Decodes `blob`, scales it to IMAGE_MAX_EDGE and re-encodes it.
 * Throws when the browser cannot decode it: that is not an image anyone can see.
 */
export async function normalizeImage(blob) {
  const source = await decode(blob)
  const width = source.width || source.naturalWidth
  const height = source.height || source.naturalHeight
  if (!width || !height) throw new Error('The image has no size')
  const size = fitWithin(width, height)

  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const context = canvas.getContext('2d')
  let type = preferredOutputType(blob.type)
  // JPEG has no alpha: transparent areas would turn black.
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, size.width, size.height)
  context.drawImage(source, 0, 0, size.width, size.height)
  source.close?.()

  let encoded = await encode(canvas, type)
  if (type === 'image/png' && encoded.size > PNG_MAX_BYTES) {
    type = 'image/jpeg'
    encoded = await encode(canvas, type)
  }
  const bytes = new Uint8Array(await encoded.arrayBuffer())
  return {
    base64: bytesToBase64(bytes),
    mime: type,
    width: size.width,
    height: size.height,
    originalWidth: width,
    originalHeight: height,
    bytes: bytes.length,
  }
}

/** Size of the thumbnail shown on a view_image pill, in CSS pixels. */
export const THUMBNAIL_EDGE = 64
/** Stored at twice the display size so it stays sharp on HiDPI screens. */
const THUMBNAIL_DENSITY = 2

/** The centered square of a `width`×`height` image: CSS `object-fit: cover` at 1:1. */
export function coverCrop(width, height) {
  const side = Math.min(width, height)
  return { x: Math.round((width - side) / 2), y: Math.round((height - side) / 2), side }
}

/**
 * A small square JPEG data URL of an already normalized image, for the chat.
 * A few KB: it is stored in the message and travels with snapshots and
 * exports, unlike the full image, which lives only for the turn.
 */
export async function makeThumbnail({ base64, mime }, edge = THUMBNAIL_EDGE) {
  const image = new Image()
  image.src = `data:${mime};base64,${base64}`
  await image.decode()
  const { x, y, side } = coverCrop(image.naturalWidth, image.naturalHeight)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = edge * THUMBNAIL_DENSITY
  const context = canvas.getContext('2d')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, x, y, side, side, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.8)
}

/** Only our own data URLs are rendered as thumbnails, never an arbitrary src. */
export function isThumbnailDataUrl(value) {
  return typeof value === 'string' && /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(value)
}
