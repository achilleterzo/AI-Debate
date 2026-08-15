import { useCallback, useRef, useState } from 'react'
import { Debate } from '../debate/Debate'
import { streamChat } from '../debate/Stream'
import { CONCLUSION_TYPES, conclusionTypeLabel, normalizeStandardConclusionPrompts } from '../prompts/ConclusionTypes'
import { useUiStrings } from '../i18n/UiStringsContext'
import { outputLanguageLabel, outputLanguagePhrase } from '../prompts/LanguagePrompt'
import { contextBudgetChars } from '../settings/Settings'

export function useConclusions({
  initialModel,
  initialCustomPrompt,
  // A per-type map, or the single string every version before this stored.
  initialStandardPrompts,
  models,
  participants,
  summaryModelOverride,
  defaultModel = '',
  attachedDocs,
  messages,
  summaryRef,
  baseUrl,
  uiLang,
  timeoutSec,
  debateMode = 'free',
  summaryAccumulateThreshold,
  nextSeq,
  setLastPromptEstimate,
  setLastRequest,
}) {
  const UI_STRINGS = useUiStrings()
  const [conclusions, setConclusions] = useState([])
  const [conclusionModel, setConclusionModel] = useState(initialModel || defaultModel)
  const [conclusionType, setConclusionType] = useState('summary')
  const [customConclusionPrompt, setCustomConclusionPrompt] = useState(initialCustomPrompt)
  const [standardConclusionPrompts, setStandardConclusionPrompts] = useState(() => normalizeStandardConclusionPrompts(initialStandardPrompts))
  const [conclusionRunning, setConclusionRunning] = useState(false)
  const [standardPromptsVersion, setStandardPromptsVersion] = useState(0)
  const customPromptRef = useRef(initialCustomPrompt || '')
  const standardPromptsRef = useRef(normalizeStandardConclusionPrompts(initialStandardPrompts))
  const customInputRef = useRef(null)
  const standardInputRef = useRef(null)

  const commitCustomPrompt = useCallback(value => {
    const next = String(value ?? '')
    customPromptRef.current = next
    if (customInputRef.current && customInputRef.current.value !== next) customInputRef.current.value = next
    setCustomConclusionPrompt(previous => previous === next ? previous : next)
  }, [])
  // The type is part of the commit: the panel writes into whichever type is
  // selected, and the textarea it writes from is remounted per type.
  const commitStandardPrompt = useCallback((type, value) => {
    const next = String(value ?? '')
    if (!type || type === 'custom') return
    if (standardPromptsRef.current[type] === next) return
    standardPromptsRef.current = { ...standardPromptsRef.current, [type]: next }
    if (standardInputRef.current && standardInputRef.current.value !== next) standardInputRef.current.value = next
    setStandardConclusionPrompts(previous => previous[type] === next ? previous : { ...previous, [type]: next })
  }, [])

  /**
   * Replaces the whole map, for a snapshot or an import.
   *
   * The textarea is uncontrolled, so a wholesale replacement has to tell the
   * panel to remount it — otherwise a loaded snapshot updates the state and
   * leaves the previous guidance on screen. `commitStandardPrompt` does not
   * bump it: there the DOM node is already the source of the value.
   */
  const setStandardConclusionPrompt = useCallback(value => {
    const next = normalizeStandardConclusionPrompts(value)
    standardPromptsRef.current = next
    setStandardConclusionPrompts(next)
    setStandardPromptsVersion(previous => previous + 1)
  }, [])

  const fallbackModel = defaultModel || Debate.pickOperationalModel(participants, summaryModelOverride, defaultModel)
  const effectiveConclusionModel = conclusionModel && models.includes(conclusionModel)
    ? conclusionModel
    : fallbackModel

  const generateConclusion = useCallback(async (overrides = {}) => {
    const model = overrides.model || effectiveConclusionModel
    if (!model || conclusionRunning) return

    const type = overrides.type || conclusionType
    const conclusionTypeDefinition = CONCLUSION_TYPES.find(entry => entry.id === type)
    const customPrompt = String(overrides.customPrompt ?? customPromptRef.current).trim()
    const standardPrompt = String(overrides.standardPrompt ?? standardPromptsRef.current[type] ?? '').trim()
    if (!conclusionTypeDefinition || (type === 'custom' && !customPrompt)) return

    setConclusionRunning(true)
    // The conclusion reads the live transcript, fitted to the same context
    // setting the turns use. It used to read a progressive copy kept in a ref
    // that nothing ever wrote to, so it always fell back to the whole debate
    // with every message cut to 600 characters.
    const contextChars = contextBudgetChars(summaryAccumulateThreshold)
    const { prompt } = Debate.buildConclusionRequest({
      history: messages,
      participants,
      attachedDocs,
      conclusions,
      summary: summaryRef.current,
      conclusionType: conclusionTypeDefinition,
      type,
      model,
      customPrompt,
      standardPrompt,
      debateMode,
      contextChars,
    })
    const language = outputLanguageLabel(uiLang)
    const languageNamed = outputLanguagePhrase(uiLang)
    let result = ''

    try {
      await streamChat({
        baseUrl,
        model,
        messages: [{ role: 'user', content: prompt }],
        // The transcript travels inside this one message, so the guard is
        // sized on the setting rather than on its own default ceiling.
        contextChars,
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
            content: `Rewrite the following text into a clean final answer for "${conclusionTypeDefinition.labelEn}" in ${languageNamed}.\n\nRules:\n- Remove all meta-reasoning, planning, and self-referential commentary.\n- Keep only the final content requested by the conclusion type.\n- No preamble.\n\nText to rewrite:\n${result}`,
          }],
          systemPrompt: `Return only the cleaned final answer in ${language}.`,
          // It carries the whole answer being cleaned, which is as long as the
          // conclusion just written.
          contextChars,
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
        // Stamped once, in the language the interface was in when it was
        // drawn: the title travels with the conclusion into the timeline, the
        // snapshots and the exports, where nothing can look the type up again.
        const title = type === 'custom' ? customPrompt : conclusionTypeLabel(UI_STRINGS, conclusionTypeDefinition)
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
  }, [UI_STRINGS, attachedDocs, baseUrl, conclusionRunning, conclusionType, conclusions, debateMode, effectiveConclusionModel, messages, nextSeq, participants, setLastPromptEstimate, setLastRequest, summaryAccumulateThreshold, summaryRef, timeoutSec, uiLang])

  return {
    conclusions,
    setConclusions,
    conclusionModel,
    setConclusionModel,
    conclusionType,
    setConclusionType,
    customConclusionPrompt,
    setCustomConclusionPrompt,
    standardConclusionPrompts,
    standardPromptsVersion,
    promptRefs: { custom: customInputRef, standard: standardInputRef },
    customPromptRef,
    standardPromptsRef,
    commitCustomPrompt,
    commitStandardPrompt,
    setStandardConclusionPrompt,
    conclusionRunning,
    effectiveConclusionModel,
    generateConclusion,
  }
}
