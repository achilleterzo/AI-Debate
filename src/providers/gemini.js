/**
 * Gemini through Google AI Studio's OpenAI-compatible endpoint.
 *
 * The same dialect as OpenRouter, with two differences worth naming: the
 * effort is a flat `reasoning_effort`, and the listing returns every model the
 * key can reach — embedding, image, audio and the rest — so only the ones that
 * generate text are offered. The models that do are multimodal and support
 * tools, which is why there is no capability lookup here.
 */

import { createOpenAiCompatibleProvider } from './openAiCompatible.js'
import { hostedRequest } from './hosted.js'

export const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai'

// Everything that is not a text model, by the name its id carries.
const NOT_TEXT = /embedding|image|imagen|tts|audio|live|robotics|computer-use|veo|aqa/

export const geminiProvider = createOpenAiCompatibleProvider({
  id: 'gemini',
  label: 'Gemini',
  origin: GEMINI_URL,
  reasoningField: 'reasoning_effort',
  // The usage report is an option of the stream itself here, not of the request.
  usage: { stream_options: { include_usage: true } },
  async listModels() {
    const data = JSON.parse(await hostedRequest('gemini', 'Gemini', '/models'))
    return (Array.isArray(data?.data) ? data.data : [])
      .map(model => String(model?.id || '').replace(/^models\//, ''))
      .filter(id => /^gemini-/.test(id) && !NOT_TEXT.test(id))
      .sort((left, right) => left.localeCompare(right))
  },
  async modelCapabilities(model) {
    return model ? ['tools', 'thinking', 'vision'] : []
  },
})
