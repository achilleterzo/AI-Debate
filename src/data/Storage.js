export class Storage {
  static LS_KEY = 'pap_settings'

  static LS_TOPICS_KEY = 'pap_topics'

  static LS_GLOBAL_CONSTRAINTS_HISTORY_KEY = 'pap_global_constraints_history'

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
}
