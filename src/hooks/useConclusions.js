import { useCallback, useState } from 'react'
import { Debate } from '../debate/Debate'
import { streamChat } from '../debate/Stream'
import { CONCLUSION_TYPES } from '../prompts/ConclusionTypes'
import { outputLanguageLabel, outputLanguagePhrase } from '../prompts/LanguagePrompt'

export function useConclusions({
  initialModel,
  initialCustomPrompt,
  initialStandardPrompt,
  models,
  participants,
  summaryModelOverride,
  defaultModel = '',
  attachedDocs,
  messages,
  summaryRef,
  conversationRef,
  baseUrl,
  uiLang,
  timeoutSec,
  debateMode = 'free',
  nextSeq,
  setLastPromptEstimate,
  setLastRequest,
}) {
  const [conclusions, setConclusions] = useState([])
  const [conclusionModel, setConclusionModel] = useState(initialModel || defaultModel)
  const [conclusionType, setConclusionType] = useState('summary')
  const [customConclusionPrompt, setCustomConclusionPrompt] = useState(initialCustomPrompt)
  const [standardConclusionPrompt, setStandardConclusionPrompt] = useState(initialStandardPrompt)
  const [conclusionRunning, setConclusionRunning] = useState(false)

  const fallbackModel = defaultModel || Debate.pickOperationalModel(participants, summaryModelOverride, defaultModel)
  const effectiveConclusionModel = conclusionModel && models.includes(conclusionModel)
    ? conclusionModel
    : fallbackModel

  const generateConclusion = useCallback(async () => {
    const model = effectiveConclusionModel
    if (!model || conclusionRunning) return

    const type = conclusionType
    const conclusionTypeDefinition = CONCLUSION_TYPES.find(entry => entry.id === type)
    const customPrompt = customConclusionPrompt.trim()
    const standardPrompt = standardConclusionPrompt.trim()
    if (!conclusionTypeDefinition || (type === 'custom' && !customPrompt)) return

    setConclusionRunning(true)
    const conversation = conversationRef.current || Debate.buildConclusionConversation(messages, participants, {
      limit: Number.MAX_SAFE_INTEGER,
      messageLimit: Debate.CONCLUSION_MESSAGE_LIMIT,
    })
    const context = Debate.buildConclusionContext({
      conversation,
      attachedDocs,
      conclusions,
      summary: summaryRef.current,
      type,
      model,
      customPrompt,
      debateMode,
    })
    const prompt = Debate.buildConclusionPrompt({
      conclusionType: conclusionTypeDefinition,
      context,
      customPrompt,
      standardPrompt,
    })
    const language = outputLanguageLabel(uiLang)
    const languageNamed = outputLanguagePhrase(uiLang)
    let result = ''

    try {
      await streamChat({
        baseUrl,
        model,
        messages: [{ role: 'user', content: prompt }],
        systemPrompt: `You are an expert analyst. Respond only with the requested ${conclusionTypeDefinition.labelEn.toLowerCase()}, no preamble. Respect the shared debate mode and its mode-specific conclusion guidance in the user prompt. Write in ${languageNamed}. Never reveal chain-of-thought, planning notes, or meta-commentary (e.g., "the user is asking", "let me analyze"). Output final answer only.`,
        useTools: false,
        onEstimate: setLastPromptEstimate,
        onPayload: request => setLastRequest?.({ request }),
        onResponse: exchange => setLastRequest?.(exchange),
        onToken: token => { result = token },
        timeoutMs: timeoutSec * 1000,
      })
      result = result.trim()
      if (Debate.shouldRewriteConclusionResult(result, uiLang)) {
        let cleaned = ''
        await streamChat({
          baseUrl,
          model,
          messages: [{
            role: 'user',
            content: `Rewrite the following text into a clean final answer for "${conclusionTypeDefinition.label}" in ${languageNamed}.\n\nRules:\n- Remove all meta-reasoning, planning, and self-referential commentary.\n- Keep only the final content requested by the conclusion type.\n- No preamble.\n\nText to rewrite:\n${result}`,
          }],
          systemPrompt: `Return only the cleaned final answer in ${language}.`,
          useTools: false,
          onEstimate: setLastPromptEstimate,
          onPayload: request => setLastRequest?.({ request }),
          onResponse: exchange => setLastRequest?.(exchange),
          onToken: token => { cleaned = token },
          timeoutMs: timeoutSec * 1000,
        })
        result = (cleaned || result).trim()
      }
      if (result) {
        const title = type === 'custom' ? customPrompt : conclusionTypeDefinition.label
        setConclusions(previous => [...previous, {
          type,
          model,
          title,
          customPrompt: type === 'custom' ? customPrompt : null,
          content: result,
          createdAt: new Date().toISOString(),
          seq: nextSeq(),
        }])
      }
    } catch (error) {
      console.warn('[conclusion] error:', error.message)
    } finally {
      setConclusionRunning(false)
    }
  }, [attachedDocs, baseUrl, conclusionRunning, conclusionType, conclusions, conversationRef, customConclusionPrompt, debateMode, effectiveConclusionModel, messages, nextSeq, participants, setLastPromptEstimate, setLastRequest, standardConclusionPrompt, summaryRef, timeoutSec, uiLang])

  return {
    conclusions,
    setConclusions,
    conclusionModel,
    setConclusionModel,
    conclusionType,
    setConclusionType,
    customConclusionPrompt,
    setCustomConclusionPrompt,
    standardConclusionPrompt,
    setStandardConclusionPrompt,
    conclusionRunning,
    effectiveConclusionModel,
    generateConclusion,
  }
}
