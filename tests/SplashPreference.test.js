import { afterEach, describe, expect, it } from 'vitest'
import { Storage } from '../src/data/Storage'
import { DEFAULT_SHOW_SPLASH, SPLASH_STORAGE_KEY } from '../src/settings/Settings'

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

describe('splash startup preference', () => {
  it('shows the splash on a fresh install', () => {
    stubLocalStorage()
    expect(Storage.loadShowSplashOnStartup()).toBe(DEFAULT_SHOW_SPLASH)
  })

  it('reads the stored choice', () => {
    stubLocalStorage({ [SPLASH_STORAGE_KEY]: 'false' })
    expect(Storage.loadShowSplashOnStartup()).toBe(false)

    stubLocalStorage({ [SPLASH_STORAGE_KEY]: 'true' })
    expect(Storage.loadShowSplashOnStartup()).toBe(true)
  })

  it('persists the toggle as a string flag', () => {
    const store = stubLocalStorage()
    Storage.saveShowSplashOnStartup(false)
    expect(store[SPLASH_STORAGE_KEY]).toBe('false')
    Storage.saveShowSplashOnStartup(true)
    expect(store[SPLASH_STORAGE_KEY]).toBe('true')
  })

  it('falls back to the default when storage is unavailable', () => {
    stubBrokenLocalStorage()
    expect(Storage.loadShowSplashOnStartup()).toBe(DEFAULT_SHOW_SPLASH)
    expect(() => Storage.saveShowSplashOnStartup(false)).not.toThrow()
  })
})
