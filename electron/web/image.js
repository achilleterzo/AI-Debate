import { assertAllowedUrl, browserSession, captureInBrowser } from './browserSession.js'

const MAX_IMAGE_BYTES = 15 * 1024 * 1024
const FETCH_TIMEOUT_MS = 20_000
const CAPTURE_TIMEOUT_MS = 30_000

/** Reads the body, refusing it as soon as it grows past `limit`. */
async function readCapped(response, limit) {
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > limit) throw new Error(`Image too large (${Math.round(declared / 1024 / 1024)} MB)`)
  const reader = response.body?.getReader()
  if (!reader) return new Uint8Array(await response.arrayBuffer())
  const chunks = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > limit) {
      await reader.cancel().catch(() => {})
      throw new Error(`Image larger than ${Math.round(limit / 1024 / 1024)} MB`)
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return bytes
}

/**
 * What `url` looks like, for the view_image tool.
 *
 * An image URL comes back as its bytes. A web page comes back as a PNG of the
 * page as rendered in the shared browser window: "look at this page" is a
 * visual request too, and the text extraction of fetch_url cannot answer it.
 *
 * `session.fetch` runs through the session's webRequest filter, so every
 * redirect hop meets the same private-network rule as a page navigation.
 * (`redirect: 'manual'` is no alternative: Electron cancels every redirect.)
 */
export async function browserFetchImage({ url } = {}) {
  const target = await assertAllowedUrl(url)
  let response
  try {
    response = await browserSession().fetch(target, {
      headers: { Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8,text/html;q=0.5,*/*;q=0.1' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
  } catch (error) {
    if (/ERR_BLOCKED_BY_CLIENT/i.test(error?.message || '')) throw new Error('Private or unsafe destination was blocked')
    throw error
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`)

  const type = String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
  if (type.startsWith('image/')) {
    return { kind: 'image', mime: type, data: await readCapped(response, MAX_IMAGE_BYTES), url: target }
  }
  await response.body?.cancel().catch(() => {})
  if (type === 'text/html' || type === 'application/xhtml+xml') {
    const png = await captureInBrowser(target, { timeoutMs: CAPTURE_TIMEOUT_MS })
    return { kind: 'page', mime: 'image/png', data: new Uint8Array(png), url: target }
  }
  throw new Error(`Not an image or a web page (${type || 'unknown content type'})`)
}
