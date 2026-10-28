import { ollamaProvider } from './ollama.js'
import { codexProvider } from './codex.js'
import { claudeProvider } from './claude.js'
import { ollamaCloudProvider } from './ollamaCloud.js'
import { openRouterProvider } from './openRouter.js'
import { geminiProvider } from './gemini.js'

export const PROVIDERS = {
  [ollamaProvider.id]: ollamaProvider,
  [ollamaCloudProvider.id]: ollamaCloudProvider,
  [openRouterProvider.id]: openRouterProvider,
  [geminiProvider.id]: geminiProvider,
  [codexProvider.id]: codexProvider,
  [claudeProvider.id]: claudeProvider,
}

export const DEFAULT_PROVIDER_ID = ollamaProvider.id
let activeProviderId = DEFAULT_PROVIDER_ID

export function setActiveProviderId(id) {
  activeProviderId = PROVIDERS[id] ? id : DEFAULT_PROVIDER_ID
}

export function getProvider(id = activeProviderId) {
  return PROVIDERS[id] ?? PROVIDERS[DEFAULT_PROVIDER_ID]
}

/**
 * The generation parameters the user set, per provider, as a request carries
 * them: only what was actually set.
 *
 * Pushed in from the settings rather than read out of them, like the web
 * service is, because a request is built far from React — and because every
 * turn of a debate may run on a different provider, each with its own.
 */
let providerOptions = {}

export function configureProviderOptions(options) {
  providerOptions = options && typeof options === 'object' && !Array.isArray(options) ? options : {}
}

export function getProviderOptions(id = activeProviderId) {
  return providerOptions[id] ?? {}
}

export { ollamaProvider, ollamaCloudProvider, openRouterProvider, geminiProvider, codexProvider, claudeProvider }
