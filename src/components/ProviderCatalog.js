import ollamaLogo from '../assets/provider-logos/ollama.svg'
import codexLogo from '../assets/provider-logos/codex.svg'
import claudeLogo from '../assets/provider-logos/claude-code.svg'
import openRouterLogo from '../assets/provider-logos/openrouter.svg'
import geminiLogo from '../assets/provider-logos/gemini.svg'

/**
 * The providers as the interface presents them: the order of the tabs, the
 * name each one is known by, how it is reached, and its mark.
 *
 * One list, because the same four facts are needed in three places — the
 * provider tabs, the model group next to every participant, and the dialog
 * header — and three copies of them is how one of them ends up saying
 * "OpenAI" after the client was renamed.
 */
export const PROVIDER_CATALOG = [
  { id: 'ollama', label: 'Ollama', detail: 'Local HTTP', logo: ollamaLogo },
  { id: 'ollama-cloud', label: 'Ollama Cloud', detail: 'API key', logo: ollamaLogo },
  { id: 'openrouter', label: 'OpenRouter', detail: 'API key', logo: openRouterLogo },
  { id: 'gemini', label: 'Gemini', detail: 'API key', logo: geminiLogo },
  { id: 'codex', label: 'Codex', detail: 'Codex CLI · OAuth', logo: codexLogo },
  { id: 'claude', label: 'Claude', detail: 'Claude CLI · OAuth', logo: claudeLogo },
]

/** The providers that are a desktop client the user logs into. */
export const CLI_PROVIDER_IDS = ['codex', 'claude']

export const PROVIDER_LOGOS = Object.fromEntries(PROVIDER_CATALOG.map(provider => [provider.id, provider.logo]))
export const PROVIDER_LABELS = Object.fromEntries(PROVIDER_CATALOG.map(provider => [provider.id, provider.label]))

export function providerLabel(providerId) {
  return PROVIDER_LABELS[providerId] ?? PROVIDER_LABELS.ollama
}

/** Where each API key is used, and what an empty model list means there. */
export const KEY_PROVIDER_DETAILS = {
  'ollama-cloud': { label: 'Ollama Cloud API key', origin: 'https://ollama.com', empty: 'Connect with an API key to retrieve the available cloud models.' },
  openrouter: { label: 'OpenRouter API key', origin: 'https://openrouter.ai', empty: 'Connect with an API key to retrieve the OpenRouter catalogue.' },
  gemini: { label: 'Gemini API key', origin: 'https://aistudio.google.com', empty: 'Connect with an API key to retrieve the available Gemini models.' },
}
