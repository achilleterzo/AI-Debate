import { SEARCH_ENGINES } from './catalog.js'
import bing from './bing.js'
import brave from './brave.js'
import duckduckgo from './duckduckgo.js'
import google from './google.js'
import qwant from './qwant.js'
import yandex from './yandex.js'

/**
 * Main-process view of each engine: catalog metadata plus how to build its
 * URL and read its result page. Adding an engine = one descriptor file, one
 * line here, one line in the catalog, one HTML fixture in the tests.
 */
const DESCRIPTORS = { bing, brave, duckduckgo, google, qwant, yandex }

export const ENGINES = Object.fromEntries(SEARCH_ENGINES.map(info => {
  const descriptor = DESCRIPTORS[info.id]
  if (!descriptor) throw new Error(`Search engine "${info.id}" is in the catalog but has no descriptor`)
  return [info.id, { ...info, ...descriptor }]
}))

export function engineById(id) {
  return ENGINES[id] ?? null
}
