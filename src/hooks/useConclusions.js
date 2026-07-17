import { useCallback, useState } from 'react'
import { Debate } from '../debate/Debate'
import { streamChat } from '../debate/Stream'
import { CONCLUSION_TYPES } from '../prompts/ConclusionTypes'
import { UI_LANGUAGE_OPTIONS } from '../i18n/UiStrings'

export function useConclusions({
  initialModel,
  initialCustomPrompt,
  initialStandardPrompt,
  models,
  participants,
  summaryModelEnabled,
  summaryModelOverride,
  attachedDocs,
  messages,
  summaryRef,
  conversationRef,
  baseUrl,
  uiLang,
  timeoutSec,
  nextSeq,
  setLastPromptEstimate,
}) {
  const [conclusions, setConclusions] = useState([])
  const [conclusionModel, setConclusionModel] = useState(initialModel)
  const [conclusionType, setConclusionType] = useState('summary')
  const [customConclusionPrompt, setCustomConclusionPrompt] = useState(initialCustomPrompt)
  const [standardConclusionPrompt, setStandardConclusionPrompt] = useState(initialStandardPrompt)
  const [conclusionRunning, setConclusionRunning] = useState(false)

  const fallbackModel = Debate.pickOperationalModel(participants, summaryModelEnabled, summaryModelOverride)
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
    })
    const prompt = Debate.buildConclusionPrompt({
      conclusionType: conclusionTypeDefinition,
      context,
      customPrompt,
      standardPrompt,
    })
    const language = UI_LANGUAGE_OPTIONS.find(entry => entry.code === uiLang)?.label ?? uiLang
    let result = ''

    try {
      await streamChat({
        baseUrl,
        model,
        messages: [{ ollamaRole: 'user', content: prompt }],
        systemPrompt: `You are an expert analyst. Respond only with the requested ${conclusionTypeDefinition.labelEn.toLowerCase()}, no preamble. Write in ${language} (language code: ${uiLang}). Never reveal chain-of-thought, planning notes, or meta-commentary (e.g., "the user is asking", "let me analyze"). Output final answer only.`,
        useTools: false,
        onEstimate: setLastPromptEstimate,
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
            ollamaRole: 'user',
            content: `Rewrite the following text into a clean final answer for "${conclusionTypeDefinition.label}" in ${language} (language code: ${uiLang}).\n\nRules:\n- Remove all meta-reasoning, planning, and self-referential commentary.\n- Keep only the final content requested by the conclusion type.\n- No preamble.\n\nText to rewrite:\n${result}`,
          }],
          systemPrompt: `Return only the cleaned final answer in ${language}.`,
          useTools: false,
          onEstimate: setLastPromptEstimate,
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
  }, [attachedDocs, baseUrl, conclusionRunning, conclusionType, conclusions, conversationRef, customConclusionPrompt, effectiveConclusionModel, messages, nextSeq, participants, setLastPromptEstimate, standardConclusionPrompt, summaryRef, timeoutSec, uiLang])

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
