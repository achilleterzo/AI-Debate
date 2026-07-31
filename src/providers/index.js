import { ollamaProvider } from './ollama.js'

export const PROVIDERS = {
  [ollamaProvider.id]: ollamaProvider,
}

export const DEFAULT_PROVIDER_ID = ollamaProvider.id

export function getProvider(id = DEFAULT_PROVIDER_ID) {
  return PROVIDERS[id] ?? PROVIDERS[DEFAULT_PROVIDER_ID]
}

export { ollamaProvider }
