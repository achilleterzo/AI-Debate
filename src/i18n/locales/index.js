import it from './it.js'
import fr from './fr.js'
import de from './de.js'
import es from './es.js'
import pt from './pt.js'
import ja from './ja.js'
import zh from './zh.js'
import ko from './ko.js'

export const LOCALES = { it, fr, de, es, pt, ja, zh, ko }

// 'en' is always available since UI_STRINGS itself is the English base.
export const TRANSLATED_LANGUAGE_CODES = ['en', ...Object.keys(LOCALES)]
