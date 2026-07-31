import { describe, expect, it, vi } from 'vitest'
import {
  UPDATE_ERROR,
  UPDATE_STATUS,
  buildDevUpdateOverride,
  checkForUpdates,
  compareVersions,
  isPrerelease,
  parseVersion,
  pickLatestRelease,
} from '../src/services/Updates'

const release = (tag, extra = {}) => ({
  tag_name: tag,
  html_url: `https://github.com/o/r/releases/tag/${tag}`,
  draft: false,
  prerelease: tag.includes('-'),
  ...extra,
})

function mockFetch(payload, { ok = true, status = 200 } = {}) {
  return vi.fn(async () => ({ ok, status, json: async () => payload }))
}

describe('parseVersion', () => {
  it('accepts both bare and v-prefixed tags', () => {
    expect(parseVersion('1.2.0')).toMatchObject({ major: 1, minor: 2, patch: 0, prerelease: [] })
    expect(parseVersion('v1.2.0')).toMatchObject({ major: 1, minor: 2, patch: 0 })
    expect(parseVersion(' v10.0.3 ')).toMatchObject({ major: 10, minor: 0, patch: 3 })
  })

  it('captures prerelease identifiers and ignores build metadata', () => {
    expect(parseVersion('1.3.0-beta.2').prerelease).toEqual(['beta', '2'])
    expect(parseVersion('1.3.0+build.5').prerelease).toEqual([])
  })

  it('returns null for junk', () => {
    expect(parseVersion('not-a-version')).toBeNull()
    expect(parseVersion('')).toBeNull()
    expect(parseVersion(undefined)).toBeNull()
  })
})

describe('compareVersions', () => {
  it('orders by major, minor and patch', () => {
    expect(compareVersions('1.2.0', '1.1.9')).toBe(1)
    expect(compareVersions('1.2.0', '2.0.0')).toBe(-1)
    expect(compareVersions('1.2.3', 'v1.2.3')).toBe(0)
  })

  it('does not compare version parts as strings', () => {
    expect(compareVersions('1.10.0', '1.9.0')).toBe(1)
  })

  it('ranks a stable release above its own prereleases', () => {
    expect(compareVersions('1.3.0', '1.3.0-beta.1')).toBe(1)
    expect(compareVersions('1.3.0-beta.1', '1.3.0-beta.2')).toBe(-1)
    expect(compareVersions('1.3.0-alpha', '1.3.0-beta')).toBe(-1)
  })
})

describe('pickLatestRelease', () => {
  const releases = [
    release('v1.1.0'),
    release('v1.2.0'),
    release('v1.3.0-beta.1'),
    release('v1.0.9'),
  ]

  it('ignores prereleases when running a stable build', () => {
    expect(pickLatestRelease(releases, '1.2.0').tag_name).toBe('v1.2.0')
  })

  it('considers prereleases when already running one', () => {
    expect(pickLatestRelease(releases, '1.3.0-beta.0').tag_name).toBe('v1.3.0-beta.1')
  })

  it('skips drafts and unparsable tags', () => {
    const noisy = [release('v1.5.0', { draft: true }), release('nightly'), release('v1.2.0')]
    expect(pickLatestRelease(noisy, '1.0.0').tag_name).toBe('v1.2.0')
  })

  it('returns null when nothing qualifies', () => {
    expect(pickLatestRelease([], '1.0.0')).toBeNull()
    expect(pickLatestRelease(null, '1.0.0')).toBeNull()
  })
})

describe('isPrerelease', () => {
  it('detects the running channel', () => {
    expect(isPrerelease('1.2.0')).toBe(false)
    expect(isPrerelease('1.3.0-beta.1')).toBe(true)
  })
})

describe('buildDevUpdateOverride', () => {
  it('is inert in production even when the parameter is present', () => {
    expect(buildDevUpdateOverride('?devUpdate=9.9.9', { isDev: false, currentVersion: '1.2.0' })).toBeNull()
  })

  it('is inert in development without the parameter', () => {
    expect(buildDevUpdateOverride('?other=1', { isDev: true, currentVersion: '1.2.0' })).toBeNull()
    expect(buildDevUpdateOverride('', { isDev: true, currentVersion: '1.2.0' })).toBeNull()
  })

  it('invents a newer version when the parameter carries no value', () => {
    const result = buildDevUpdateOverride('?devUpdate', { isDev: true, currentVersion: '1.2.0' })
    expect(result).toMatchObject({
      status: UPDATE_STATUS.AVAILABLE,
      currentVersion: '1.2.0',
      latestVersion: '2.0.0',
      forced: true,
    })
    expect(result.releaseUrl).toContain('/releases')
  })

  it('pins the version when one is given', () => {
    expect(buildDevUpdateOverride('?devUpdate=v3.4.5', { isDev: true, currentVersion: '1.2.0' }))
      .toMatchObject({ latestVersion: '3.4.5' })
  })

  it('falls back to a plausible version when the value is not semver', () => {
    expect(buildDevUpdateOverride('?devUpdate=yes', { isDev: true, currentVersion: '1.2.0' }))
      .toMatchObject({ latestVersion: '2.0.0' })
    expect(buildDevUpdateOverride('?devUpdate=yes', { isDev: true, currentVersion: '' }))
      .toMatchObject({ latestVersion: '99.0.0' })
  })
})

describe('checkForUpdates', () => {
  it('reports an available update with the release url', async () => {
    const result = await checkForUpdates({
      currentVersion: '1.2.0',
      fetchImpl: mockFetch([release('v1.2.0'), release('v1.4.0')]),
    })

    expect(result.status).toBe(UPDATE_STATUS.AVAILABLE)
    expect(result.latestVersion).toBe('1.4.0')
    expect(result.releaseUrl).toContain('v1.4.0')
  })

  it('reports up to date when the newest release is the running one', async () => {
    const result = await checkForUpdates({
      currentVersion: '1.2.0',
      fetchImpl: mockFetch([release('v1.2.0'), release('v1.1.0')]),
    })
    expect(result.status).toBe(UPDATE_STATUS.UP_TO_DATE)
  })

  it('does not offer a downgrade when running ahead of the latest release', async () => {
    const result = await checkForUpdates({
      currentVersion: '2.0.0',
      fetchImpl: mockFetch([release('v1.2.0')]),
    })
    expect(result.status).toBe(UPDATE_STATUS.UP_TO_DATE)
  })

  it('surfaces HTTP failures instead of claiming to be up to date', async () => {
    const result = await checkForUpdates({
      currentVersion: '1.2.0',
      fetchImpl: mockFetch(null, { ok: false, status: 403 }),
    })
    expect(result.status).toBe(UPDATE_STATUS.ERROR)
    expect(result.errorKind).toBe(UPDATE_ERROR.HTTP)
    expect(result.error).toBe('HTTP 403')
  })

  it('classifies a failed connection as unreachable', async () => {
    const result = await checkForUpdates({
      currentVersion: '1.2.0',
      fetchImpl: vi.fn(async () => { throw new TypeError('Failed to fetch') }),
    })
    expect(result.status).toBe(UPDATE_STATUS.ERROR)
    expect(result.errorKind).toBe(UPDATE_ERROR.UNREACHABLE)
    expect(result.error).toBe('Failed to fetch')
  })

  it('errors cleanly when fetch is unavailable', async () => {
    const result = await checkForUpdates({ currentVersion: '1.2.0', fetchImpl: null })
    expect(result.status).toBe(UPDATE_STATUS.ERROR)
  })

  it('gives up on its own when the connection hangs', async () => {
    // Mimics a real fetch against an unreachable host: it never settles until
    // the abort signal fires, which is what the internal timeout must trigger.
    const hangingFetch = vi.fn((_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => {
        const err = new Error('aborted')
        err.name = 'AbortError'
        reject(err)
      })
    }))

    const startedAt = Date.now()
    const result = await checkForUpdates({
      currentVersion: '1.2.0',
      fetchImpl: hangingFetch,
      timeoutMs: 80,
    })

    expect(result.status).toBe(UPDATE_STATUS.ERROR)
    expect(result.errorKind).toBe(UPDATE_ERROR.UNREACHABLE)
    expect(result.error).toBe('timeout')
    expect(Date.now() - startedAt).toBeLessThan(2000)
  })

  it('honours an external abort signal', async () => {
    const controller = new AbortController()
    const hangingFetch = vi.fn((_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => {
        const err = new Error('aborted')
        err.name = 'AbortError'
        reject(err)
      })
    }))

    const pending = checkForUpdates({
      currentVersion: '1.2.0',
      fetchImpl: hangingFetch,
      signal: controller.signal,
      timeoutMs: 5000,
    })
    controller.abort()

    expect((await pending).status).toBe(UPDATE_STATUS.ERROR)
  })
})
