import { afterEach, describe, expect, it } from 'vitest'
import { Storage } from '../src/data/Storage'
import {
  DEFAULT_SHOW_IMPORT_NOTICE,
  DISMISSIBLE_NOTICE_KEYS,
  IMPORT_NOTICE_STORAGE_KEY,
  SPLASH_STORAGE_KEY,
} from '../src/settings/Settings'

// The tests run in the node environment, so localStorage is stubbed per case.
function stubLocalStorage(initial = {}) {
  const store = { ...initial }
  globalThis.localStorage = {
    getItem: key => (key in store ? store[key] : null),
    setItem: (key, value) => { store[key] = String(value) },
    removeItem: key => { delete store[key] },
  }
  return store
}

function stubBrokenLocalStorage() {
  globalThis.localStorage = {
    getItem: () => { throw new Error('denied') },
    setItem: () => { throw new Error('denied') },
    removeItem: () => { throw new Error('denied') },
  }
}

afterEach(() => {
  delete globalThis.localStorage
})

describe('import notice preference', () => {
  it('shows the notice on a fresh install', () => {
    stubLocalStorage()
    expect(Storage.loadShowImportNotice()).toBe(DEFAULT_SHOW_IMPORT_NOTICE)
  })

  it('reads and writes the stored choice', () => {
    const store = stubLocalStorage()
    Storage.saveShowImportNotice(false)
    expect(store[IMPORT_NOTICE_STORAGE_KEY]).toBe('false')
    expect(Storage.loadShowImportNotice()).toBe(false)
  })

  it('falls back to the default when storage is unavailable', () => {
    stubBrokenLocalStorage()
    expect(Storage.loadShowImportNotice()).toBe(DEFAULT_SHOW_IMPORT_NOTICE)
    expect(() => Storage.saveShowImportNotice(false)).not.toThrow()
  })
})

describe('Storage.restoreNotices', () => {
  it('brings a dismissed notice back', () => {
    stubLocalStorage({ [IMPORT_NOTICE_STORAGE_KEY]: 'false' })
    expect(Storage.loadShowImportNotice()).toBe(false)
    Storage.restoreNotices()
    expect(Storage.loadShowImportNotice()).toBe(true)
  })

  it('removes the key rather than writing the default back', () => {
    // Absence is what a fresh install looks like, and it is what keeps a later
    // change of default from being overridden by a stale stored value.
    const store = stubLocalStorage({ [IMPORT_NOTICE_STORAGE_KEY]: 'false' })
    Storage.restoreNotices()
    expect(IMPORT_NOTICE_STORAGE_KEY in store).toBe(false)
  })

  it('clears every dismissible notice it knows about', () => {
    const store = stubLocalStorage(Object.fromEntries(DISMISSIBLE_NOTICE_KEYS.map(key => [key, 'false'])))
    Storage.restoreNotices()
    expect(Object.keys(store)).toEqual([])
  })

  it('leaves the splash alone, which has its own entry in the menu', () => {
    const store = stubLocalStorage({ [SPLASH_STORAGE_KEY]: 'false', [IMPORT_NOTICE_STORAGE_KEY]: 'false' })
    Storage.restoreNotices()
    expect(store[SPLASH_STORAGE_KEY]).toBe('false')
    expect(Storage.loadShowSplashOnStartup()).toBe(false)
  })

  it('is harmless when nothing was dismissed, and when storage is unavailable', () => {
    stubLocalStorage()
    expect(() => Storage.restoreNotices()).not.toThrow()
    stubBrokenLocalStorage()
    expect(() => Storage.restoreNotices()).not.toThrow()
  })
})
