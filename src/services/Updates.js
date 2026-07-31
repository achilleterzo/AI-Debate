import { UPDATE_CHECK_TIMEOUT_MS, UPDATE_RELEASES_URL, UPDATE_REPO } from '../settings/Settings.js'

export const UPDATE_STATUS = {
  IDLE: 'idle',
  CHECKING: 'checking',
  UP_TO_DATE: 'upToDate',
  AVAILABLE: 'available',
  ERROR: 'error',
}

export const UPDATE_ERROR = {
  /** GitHub could not be reached at all: offline, DNS, proxy or firewall. */
  UNREACHABLE: 'unreachable',
  /** The request was answered, but not with a usable status. */
  HTTP: 'http',
  /** No usable fetch implementation in this environment. */
  UNSUPPORTED: 'unsupported',
}

// Accepts both `1.2.0` and the `v1.2.0` shape used by the release tags.
const SEMVER_RE = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/

export function parseVersion(raw) {
  const match = SEMVER_RE.exec(String(raw ?? '').trim())
  if (!match) return null
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].split('.') : [],
  }
}

function comparePrerelease(a, b) {
  // A version without prerelease identifiers outranks one that has them.
  if (a.length === 0 && b.length === 0) return 0
  if (a.length === 0) return 1
  if (b.length === 0) return -1

  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const left = a[i]
    const right = b[i]
    if (left === undefined) return -1
    if (right === undefined) return 1
    if (left === right) continue

    const leftNum = /^\d+$/.test(left)
    const rightNum = /^\d+$/.test(right)
    if (leftNum && rightNum) return Number(left) < Number(right) ? -1 : 1
    // Numeric identifiers always have lower precedence than alphanumeric ones.
    if (leftNum !== rightNum) return leftNum ? -1 : 1
    return left < right ? -1 : 1
  }
  return 0
}

/** Returns -1, 0 or 1. Unparsable versions sort last. */
export function compareVersions(rawA, rawB) {
  const a = parseVersion(rawA)
  const b = parseVersion(rawB)
  if (!a && !b) return 0
  if (!a) return -1
  if (!b) return 1

  for (const key of ['major', 'minor', 'patch']) {
    if (a[key] !== b[key]) return a[key] < b[key] ? -1 : 1
  }
  return comparePrerelease(a.prerelease, b.prerelease)
}

export function isPrerelease(raw) {
  const parsed = parseVersion(raw)
  return !!parsed && parsed.prerelease.length > 0
}

/**
 * Picks the newest release belonging to the channel the app currently runs on.
 * A stable build only ever sees stable releases; a prerelease build also sees
 * stable ones, since moving from 1.3.0-beta.1 to 1.3.0 is a real update.
 */
export function pickLatestRelease(releases, currentVersion) {
  if (!Array.isArray(releases)) return null
  const allowPrerelease = isPrerelease(currentVersion)

  return releases
    .filter(release => release && !release.draft)
    .filter(release => parseVersion(release.tag_name))
    .filter(release => allowPrerelease || !(release.prerelease || isPrerelease(release.tag_name)))
    .reduce((best, release) => (
      !best || compareVersions(release.tag_name, best.tag_name) > 0 ? release : best
    ), null)
}

export const DEV_UPDATE_PARAM = 'devUpdate'

function nextMajorOf(raw) {
  const parsed = parseVersion(raw)
  return parsed ? `${parsed.major + 1}.0.0` : '99.0.0'
}

/**
 * Dev-only override that forces the "update available" state.
 *
 * It deliberately never touches the network, so the startup banner can be
 * exercised even where GitHub is unreachable. `?devUpdate` alone invents a
 * newer version; `?devUpdate=2.5.0` pins the version shown.
 */
export function buildDevUpdateOverride(search, { isDev = false, currentVersion = '' } = {}) {
  if (!isDev) return null

  const raw = new URLSearchParams(search || '').get(DEV_UPDATE_PARAM)
  if (raw === null) return null

  return {
    status: UPDATE_STATUS.AVAILABLE,
    currentVersion,
    latestVersion: parseVersion(raw) ? formatVersion(raw) : nextMajorOf(currentVersion),
    releaseUrl: UPDATE_RELEASES_URL,
    checkedAt: Date.now(),
    forced: true,
  }
}

export function formatVersion(raw) {
  const parsed = parseVersion(raw)
  if (!parsed) return String(raw ?? '')
  const base = `${parsed.major}.${parsed.minor}.${parsed.patch}`
  return parsed.prerelease.length > 0 ? `${base}-${parsed.prerelease.join('.')}` : base
}

/**
 * Queries the GitHub releases of the configured repository and compares the
 * newest one on the current channel against the running version.
 */
export async function checkForUpdates({
  currentVersion,
  repo = UPDATE_REPO,
  fetchImpl = globalThis.fetch,
  signal = null,
  timeoutMs = UPDATE_CHECK_TIMEOUT_MS,
} = {}) {
  if (typeof fetchImpl !== 'function') {
    return {
      status: UPDATE_STATUS.ERROR,
      errorKind: UPDATE_ERROR.UNSUPPORTED,
      currentVersion,
      error: 'fetch unavailable',
    }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true })

  try {
    const response = await fetchImpl(`https://api.github.com/repos/${repo}/releases?per_page=30`, {
      signal: controller.signal,
      headers: { Accept: 'application/vnd.github+json' },
    })

    if (!response.ok) {
      return {
        status: UPDATE_STATUS.ERROR,
        errorKind: UPDATE_ERROR.HTTP,
        currentVersion,
        error: `HTTP ${response.status}`,
      }
    }

    const releases = await response.json()
    const latest = pickLatestRelease(releases, currentVersion)

    if (!latest || compareVersions(latest.tag_name, currentVersion) <= 0) {
      return { status: UPDATE_STATUS.UP_TO_DATE, currentVersion, checkedAt: Date.now() }
    }

    return {
      status: UPDATE_STATUS.AVAILABLE,
      currentVersion,
      latestVersion: formatVersion(latest.tag_name),
      releaseUrl: latest.html_url || UPDATE_RELEASES_URL,
      publishedAt: latest.published_at ?? null,
      checkedAt: Date.now(),
    }
  } catch (err) {
    // A timed-out or refused connection and an outright network failure are the
    // same thing for the user: GitHub is not reachable from this machine.
    return {
      status: UPDATE_STATUS.ERROR,
      errorKind: UPDATE_ERROR.UNREACHABLE,
      currentVersion,
      error: err?.name === 'AbortError' ? 'timeout' : (err?.message || 'network error'),
    }
  } finally {
    clearTimeout(timer)
  }
}
