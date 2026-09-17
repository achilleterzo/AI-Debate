import { ollamaProvider } from './ollama.js'
import { openaiProvider } from './openai.js'
import { claudeProvider } from './claude.js'
import { ollamaCloudProvider } from './ollamaCloud.js'

export const PROVIDERS = {
  [ollamaProvider.id]: ollamaProvider,
  [openaiProvider.id]: openaiProvider,
  [claudeProvider.id]: claudeProvider,
  [ollamaCloudProvider.id]: ollamaCloudProvider,
}

export const DEFAULT_PROVIDER_ID = ollamaProvider.id
let activeProviderId = DEFAULT_PROVIDER_ID

export function setActiveProviderId(id) {
  activeProviderId = PROVIDERS[id] ? id : DEFAULT_PROVIDER_ID
}

export function getProvider(id = activeProviderId) {
  return PROVIDERS[id] ?? PROVIDERS[DEFAULT_PROVIDER_ID]
}

export { ollamaProvider, ollamaCloudProvider, openaiProvider, claudeProvider }
