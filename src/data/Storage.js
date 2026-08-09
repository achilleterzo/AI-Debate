import { DEFAULT_SHOW_SPLASH, SPLASH_STORAGE_KEY } from '../settings/Settings'
import { Session } from './Session'

export class Storage {
  static LS_KEY = 'pap_settings'

  static LS_CHAT_KEY = 'pap_chat'

  /** Bumped when the stored shape changes; an older record is ignored, not guessed at. */
  static CHAT_VERSION = 1

  /** How many of the most recent messages survive a chat too large for the quota. */
  static CHAT_QUOTA_FALLBACK_MESSAGES = 100

  static LS_TOPICS_KEY = 'pap_topics'

  static LS_GLOBAL_CONSTRAINTS_HISTORY_KEY = 'pap_global_constraints_history'

  static LS_ENDPOINTS_HISTORY_KEY = 'pap_endpoints_history'

  static loadEndpointHistory() {
    try {
      const arr = JSON.parse(localStorage.getItem(Storage.LS_ENDPOINTS_HISTORY_KEY) || '[]')
      return Array.isArray(arr) ? arr.filter(item => typeof item === 'string' && item.trim()).map(item => item.trim()) : []
    } catch {
      return []
    }
  }

  static saveEndpointToHistory(url) {
    const trimmed = String(url || '').trim().replace(/\/$/, '')
    if (!trimmed) return Storage.loadEndpointHistory()
    const prev = Storage.loadEndpointHistory().filter(item => item !== trimmed)
    const next = [trimmed, ...prev].slice(0, 10)
    localStorage.setItem(Storage.LS_ENDPOINTS_HISTORY_KEY, JSON.stringify(next))
    return next
  }

  static deleteEndpointFromHistory(url) {
    const next = Storage.loadEndpointHistory().filter(item => item !== url)
    localStorage.setItem(Storage.LS_ENDPOINTS_HISTORY_KEY, JSON.stringify(next))
    return next
  }

  static loadTopics() {
    try {
      return JSON.parse(localStorage.getItem(Storage.LS_TOPICS_KEY)) ?? []
    } catch {
      return []
    }
  }

  static saveTopicToHistory(topic) {
    const trimmed = topic.trim()
    if (!trimmed) return
    const prev = Storage.loadTopics().filter(item => item !== trimmed)
    localStorage.setItem(Storage.LS_TOPICS_KEY, JSON.stringify([trimmed, ...prev].slice(0, 10)))
  }

  static overwriteTopics(topics) {
    localStorage.setItem(Storage.LS_TOPICS_KEY, JSON.stringify(Array.isArray(topics) ? topics : []))
  }

  static loadGlobalConstraintsHistory() {
    try {
      const arr = JSON.parse(localStorage.getItem(Storage.LS_GLOBAL_CONSTRAINTS_HISTORY_KEY) || '[]')
      return Array.isArray(arr) ? arr.filter(item => typeof item === 'string' && item.trim()).map(item => item.trim()) : []
    } catch {
      return []
    }
  }

  static saveGlobalConstraintToHistory(text) {
    const trimmed = String(text || '').trim()
    if (!trimmed) return
    const prev = Storage.loadGlobalConstraintsHistory().filter(item => item !== trimmed)
    localStorage.setItem(Storage.LS_GLOBAL_CONSTRAINTS_HISTORY_KEY, JSON.stringify([trimmed, ...prev].slice(0, 30)))
  }

  static deleteGlobalConstraintFromHistoryByIndex(idx) {
    const list = Storage.loadGlobalConstraintsHistory()
    if (!Number.isFinite(idx) || idx < 0 || idx >= list.length) return list
    const next = list.filter((_, index) => index !== idx)
    localStorage.setItem(Storage.LS_GLOBAL_CONSTRAINTS_HISTORY_KEY, JSON.stringify(next))
    return next
  }

  static saveSettings(data) {
    try {
      localStorage.setItem(Storage.LS_KEY, JSON.stringify(data))
    } catch {
      return
    }
  }

  static loadSettings() {
    try {
      const raw = localStorage.getItem(Storage.LS_KEY)
      if (!raw) return null
      return JSON.parse(raw)
    } catch {
      return null
    }
  }

  static clearSettings() {
    localStorage.removeItem(Storage.LS_KEY)
  }

  /**
   * The chat in progress, kept across a refresh and across closing the app.
   *
   * Only what cannot be recomputed travels: the transcript, the summary, the
   * conclusions, the memory, and the counters that decide where the next turn
   * goes. Debug payloads are stripped — they are the largest thing a message
   * carries and they exist for the run that produced them.
   *
   * A transcript can outgrow the storage quota. Losing the recent turns to keep
   * the opening ones would be the wrong half, so the retry keeps the tail; if
   * even that fails the record is removed rather than left half written.
   */
  static saveChat(chat) {
    const messages = Session.stripDebugFields(chat?.messages ?? [])
    const write = list => localStorage.setItem(Storage.LS_CHAT_KEY, JSON.stringify({
      ...chat,
      version: Storage.CHAT_VERSION,
      savedAt: new Date().toISOString(),
      messages: list,
    }))

    try {
      write(messages)
      return true
    } catch {
      try {
        console.warn('[chat] transcript too large for local storage — keeping the most recent messages')
        write(messages.slice(-Storage.CHAT_QUOTA_FALLBACK_MESSAGES))
        return true
      } catch {
        Storage.clearChat()
        return false
      }
    }
  }

  static loadChat() {
    try {
      const raw = localStorage.getItem(Storage.LS_CHAT_KEY)
      if (!raw) return null
      const data = JSON.parse(raw)
      if (!data || data.version !== Storage.CHAT_VERSION) return null
      return {
        ...data,
        messages: Session.restorableMessages(Array.isArray(data.messages) ? data.messages : []),
        conclusions: Array.isArray(data.conclusions) ? data.conclusions : [],
        memory: Array.isArray(data.memory) ? data.memory : [],
        summary: typeof data.summary === 'string' ? data.summary : '',
      }
    } catch {
      return null
    }
  }

  static clearChat() {
    try {
      localStorage.removeItem(Storage.LS_CHAT_KEY)
    } catch {
      return
    }
  }

  static loadShowSplashOnStartup() {
    try {
      const raw = localStorage.getItem(SPLASH_STORAGE_KEY)
      return raw === null ? DEFAULT_SHOW_SPLASH : raw === 'true'
    } catch {
      return DEFAULT_SHOW_SPLASH
    }
  }

  static saveShowSplashOnStartup(value) {
    try {
      localStorage.setItem(SPLASH_STORAGE_KEY, String(!!value))
    } catch {
      return
    }
  }
}
