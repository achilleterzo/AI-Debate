import { app, BrowserWindow } from 'electron'
import { assertPublicHttpUrl } from './urlSafety.js'

/**
 * One long-lived, hidden Chromium window that every web_search and fetch_url
 * goes through, one at a time.
 *
 * Keeping the window and its cookie jar alive between requests is deliberate:
 * a browser that accepted a consent banner once and keeps its cookies looks
 * like a person, a brand-new profile on every request looks like a bot. The
 * partition name is the one searches already used, so existing consent
 * cookies carry over. The window can be shown to see what a participant is
 * reading; closing it only hides it again.
 */
const PARTITION = 'persist:ai-debate-search'
const RENDER_SETTLE_MS = 900
const CONSENT_SETTLE_MS = 1_200
const DNS_CACHE = new Map()
const SECURED_SESSIONS = new WeakSet()

let browserWindow = null
let queue = Promise.resolve()
let quitting = false

app.on('before-quit', () => { quitting = true })

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Electron's default user agent advertises `Electron/x` and the app's own
 * name, which is exactly the kind of oddity that gets a client challenged.
 */
function plainUserAgent(userAgent) {
  const appToken = app.getName().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return userAgent
    .replace(/\sElectron\/\S+/i, '')
    .replace(new RegExp(`\\s${appToken}/\\S+`, 'i'), '')
}

function secureSession(ses) {
  if (SECURED_SESSIONS.has(ses)) return
  SECURED_SESSIONS.add(ses)
  ses.setUserAgent(plainUserAgent(ses.getUserAgent()))
  ses.setPermissionCheckHandler(() => false)
  ses.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false))
  ses.on('will-download', event => event.preventDefault())
  ses.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => {
    if (/^(?:data|blob):/i.test(details.url)) { callback({ cancel: false }); return }
    assertPublicHttpUrl(details.url, DNS_CACHE)
      .then(() => callback({ cancel: false }))
      .catch(() => callback({ cancel: true }))
  })
}

function ensureWindow() {
  if (browserWindow && !browserWindow.isDestroyed()) return browserWindow
  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 900,
    title: 'AI Debate — Web',
    autoHideMenuBar: true,
    webPreferences: {
      partition: PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      javascript: true,
      webSecurity: true,
      // Hidden is the normal state of this window; throttled timers would
      // leave client-rendered result pages half drawn.
      backgroundThrottling: false,
    },
  })
  secureSession(win.webContents.session)
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-attach-webview', event => event.preventDefault())
  win.webContents.on('login', (event, _details, _authInfo, callback) => { event.preventDefault(); callback() })
  win.on('close', event => {
    if (quitting) return
    event.preventDefault()
    win.hide()
  })
  win.on('closed', () => { if (browserWindow === win) browserWindow = null })
  browserWindow = win
  return win
}

/** Rejects after `ms`, running `onTimeout` first; the losing promise is left to settle alone. */
function withDeadline(promise, ms, onTimeout) {
  let timer
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        onTimeout?.()
        reject(new Error('Browser navigation timed out'))
      }, ms)
    }),
  ]).finally(() => clearTimeout(timer))
}

async function dismissCookieConsent(win) {
  if (win.isDestroyed()) return false
  let clicked = false
  try {
    clicked = await win.webContents.executeJavaScript(`(() => {
      const page = String(document.body?.innerText || '').slice(0, 5000).toLowerCase()
      if (!/(cookie|consent|privacy|personalizzazione|personalization|annunci|advertising|dati|data)/i.test(page)) return false
      const controls = [...document.querySelectorAll('button, [role="button"], input[type="submit"]')]
      const label = element => String(element.innerText || element.value || element.getAttribute('aria-label') || '').trim().toLowerCase()
      const rejectLabels = /^(reject all|reject|decline|rifiuta tutto|rifiuta|refuse all|refuser|tout refuser|rechazar todo|rechazar|alle ablehnen|ablehnen|rejeitar tudo|rejeitar)$/i
      const reject = controls.find(element => rejectLabels.test(label(element)))
      if (!reject) return false
      reject.click()
      return true
    })()`, true)
  } catch { return false }
  if (clicked) await delay(CONSENT_SETTLE_MS)
  return clicked
}

async function navigate(win, target) {
  const loading = win.loadURL(target)
  // If the deadline wins, this promise still rejects later; nobody else is listening.
  loading.catch(() => {})
  try {
    await loading
  } catch (error) {
    // Google commonly replaces the first navigation with an equivalent URL
    // carrying a `sei` parameter. Chromium reports the superseded request as
    // ERR_ABORTED (-3), even though the replacement page is alive and keeps
    // loading. Treat it as recoverable only when the webContents has actually
    // reached another public HTTP(S) page; a genuinely cancelled blank
    // navigation must still fail.
    if (error?.code === -3 || /ERR_ABORTED/i.test(error?.message || '')) {
      await delay(RENDER_SETTLE_MS)
      const currentUrl = win.isDestroyed() ? '' : win.webContents.getURL()
      if (currentUrl && currentUrl !== 'about:blank') {
        await assertPublicHttpUrl(currentUrl, DNS_CACHE)
        return
      }
    }
    if (error?.code === -20 || /ERR_BLOCKED_BY_CLIENT/i.test(error?.message || '')) {
      throw new Error('Private or unsafe browser navigation was blocked')
    }
    throw error
  }
}

/**
 * Loads `url` in the shared window and evaluates `expression` there.
 *
 * Requests are queued: there is one window, and a page must not be swapped
 * out from under an extraction. A timeout during loading just stops the load;
 * a timeout during extraction means the page's script is stuck, so the window
 * is dropped and rebuilt on the next request (the cookie jar survives it).
 */
export function runInBrowser(url, expression, { timeoutMs = 30_000 } = {}) {
  const task = queue.then(async () => {
    const target = await assertPublicHttpUrl(url, DNS_CACHE)
    const win = ensureWindow()
    let phase = 'load'
    const work = (async () => {
      await navigate(win, target)
      phase = 'extract'
      await delay(RENDER_SETTLE_MS)
      await dismissCookieConsent(win)
      return win.webContents.executeJavaScript(expression, true)
    })()
    work.catch(() => {})
    return withDeadline(work, timeoutMs, () => {
      if (win.isDestroyed()) return
      if (phase === 'load') win.webContents.stop()
      else win.destroy()
    })
  })
  queue = task.catch(() => {})
  return task
}

/** The page currently in the shared window, or null. */
export function currentPage() {
  if (!browserWindow || browserWindow.isDestroyed()) return null
  return { url: browserWindow.webContents.getURL(), title: browserWindow.webContents.getTitle() }
}

/** Brings the shared window on screen, creating it (blank) if nothing was browsed yet. */
export function showBrowser() {
  const win = ensureWindow()
  if (!win.webContents.getURL()) win.loadURL('about:blank').catch(() => {})
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
  return currentPage()
}

/** Destroys the shared window so it cannot keep the app alive after the main window closes. */
export function disposeBrowser() {
  if (browserWindow && !browserWindow.isDestroyed()) browserWindow.destroy()
  browserWindow = null
}
