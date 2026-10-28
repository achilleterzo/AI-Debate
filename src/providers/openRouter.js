/**
 * OpenRouter: one key, one API, hundreds of hosted models.
 *
 * The catalogue is also the capability table — it says which inputs each model
 * accepts and which parameters it supports — so listing the models for the
 * pickers answers, for free, what every one of them can do. Kept in memory for
 * the session: it is a single request, and a debate asks about a model on
 * every turn.
 */

import { createOpenAiCompatibleProvider } from './openAiCompatible.js'
import { hostedRequest } from './hosted.js'

export const OPENROUTER_URL = 'https://openrouter.ai/api/v1'

let catalogue = null

async function fetchCatalogue(refresh = false) {
  if (catalogue && !refresh) return catalogue
  const data = JSON.parse(await hostedRequest('openrouter', 'OpenRouter', '/models'))
  catalogue = (Array.isArray(data?.data) ? data.data : []).filter(model => typeof model?.id === 'string' && model.id)
  return catalogue
}

/**
 * What a model accepts, in the app's own vocabulary. An id that is not in the
 * catalogue — a model withdrawn, or a listing that never happened — is assumed
 * capable: the alternative is refusing to run a model that may be fine.
 */
async function modelCapabilities(model) {
  const assumed = ['tools', 'thinking']
  if (!model) return assumed
  let entry
  try {
    entry = (await fetchCatalogue()).find(item => item.id === model)
  } catch {
    return assumed
  }
  if (!entry) return assumed
  const inputs = Array.isArray(entry.architecture?.input_modalities) ? entry.architecture.input_modalities : []
  const parameters = Array.isArray(entry.supported_parameters) ? entry.supported_parameters : []
  return [
    ...(parameters.includes('tools') ? ['tools'] : []),
    ...(parameters.includes('reasoning') || parameters.includes('reasoning_effort') ? ['thinking'] : []),
    ...(inputs.includes('image') ? ['vision'] : []),
  ]
}

export const openRouterProvider = createOpenAiCompatibleProvider({
  id: 'openrouter',
  label: 'OpenRouter',
  origin: OPENROUTER_URL,
  reasoningField: 'reasoning',
  // OpenRouter reports what the turn cost in the final chunk when asked to.
  usage: { usage: { include: true } },
  async listModels() {
    const models = await fetchCatalogue(true)
    return models.map(model => model.id).sort((left, right) => left.localeCompare(right))
  },
  modelCapabilities,
})
