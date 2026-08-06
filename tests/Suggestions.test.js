import { describe, expect, it } from 'vitest'
import {
  SUGGESTION_MODE,
  MAX_CONSTRAINT_CHARS,
  buildGlobalRulesPrompt,
  buildParticipantPrompt,
  buildSuggestionPrompt,
  buildSuggestionSystemPrompt,
  isParticipantMode,
  participantMode,
  parseParticipantDrafts,
  parseSuggestions,
} from '../src/services/Suggestions'

describe('buildSuggestionSystemPrompt', () => {
  it('pins the output language and the JSON-only contract', () => {
    const prompt = buildSuggestionSystemPrompt({ languageNamed: 'Italiano (language code: it)' })
    expect(prompt).toContain('Italiano')
    expect(prompt).toContain('language code: it')
    expect(prompt).toContain('JSON array of strings')
  })
})

describe('buildSuggestionPrompt', () => {
  const context = {
    topic: 'Nuclear power',
    conversation: 'Alice: it is safe\n\nBob: waste is the issue',
    summary: 'They disagree on waste',
    participants: [{ name: 'Alice' }, { tag: 'B' }],
    count: 4,
  }

  it('asks for topic refinements when a prompt is already present', () => {
    const prompt = buildSuggestionPrompt({ mode: SUGGESTION_MODE.STEER, ...context })
    expect(prompt).toContain('Nuclear power')
    expect(prompt).toContain('Participants at the table (context only; suggestions must address the debate as a whole): Alice, B')
    expect(prompt).toContain('waste is the issue')
    expect(prompt).toContain('refinements or alternative phrasings of the current topic prompt')
    expect(prompt).toContain('Do not answer the topic')
    expect(prompt).toContain('general topic instructions for every participant')
    expect(prompt).toContain('debate as a whole')
    expect(prompt).toContain('add or redefine a participant')
  })

  it('includes the shared debate mode in generated prompt proposals', () => {
    const prompt = buildSuggestionPrompt({
      mode: SUGGESTION_MODE.STEER,
      debateMode: 'fact_check',
      debateModeLabel: 'Fact Check',
      debateModeInstruction: 'Verify important claims before accepting them.',
      ...context,
    })
    expect(prompt).toContain('Shared debate mode: Fact Check (fact_check).')
    expect(prompt).toContain('Verify important claims before accepting them.')
  })

  it('keeps Role Play steering inside the shared fiction', () => {
    const prompt = buildSuggestionPrompt({
      mode: SUGGESTION_MODE.STEER,
      debateMode: 'role_play',
      debateModeLabel: 'Role Play',
      debateModeInstruction: 'Advance the shared fiction.',
      ...context,
    })
    expect(prompt).toContain('shared scene premises')
    expect(prompt).toContain('all participants act inside the fiction')
    expect(prompt).toContain('never suggest meta-analysis')
  })

  it('uses attached documents as source material for shared topic suggestions', () => {
    const prompt = buildSuggestionPrompt({
      mode: SUGGESTION_MODE.STEER,
      topic: '',
      attachedDocs: [{ name: 'brief.md', content: 'The proposal has a high operating cost.' }],
    })
    expect(prompt).toContain('Attached documents (use these as source material for the shared topic)')
    expect(prompt).toContain('The proposal has a high operating cost.')
    expect(prompt).toContain('refinements or alternative phrasings')
  })

  it('asks for analyst guidance in conclusion mode', () => {
    const prompt = buildSuggestionPrompt({ mode: SUGGESTION_MODE.CONCLUSION, ...context })
    expect(prompt).toContain('additional guidance for the analyst')
    expect(prompt).toContain('Do not write the conclusion itself')
  })

  it('states plainly when there is nothing to go on', () => {
    const prompt = buildSuggestionPrompt({ mode: SUGGESTION_MODE.STEER })
    expect(prompt).toContain('has just started and has no exchanges yet')
  })

  it('omits sections that carry no context', () => {
    const prompt = buildSuggestionPrompt({ mode: SUGGESTION_MODE.STEER, topic: 'Only a topic' })
    expect(prompt).toContain('Only a topic')
    expect(prompt).not.toContain('Summary so far')
    expect(prompt).not.toContain('Recent exchanges')
    expect(prompt).not.toContain('Participants:')
  })
})

describe('parseSuggestions', () => {
  it('reads a plain JSON array', () => {
    expect(parseSuggestions('["First one", "Second one"]')).toEqual(['First one', 'Second one'])
  })

  it('reads a fenced JSON array', () => {
    expect(parseSuggestions('```json\n["Fenced one"]\n```')).toEqual(['Fenced one'])
  })

  it('reads a JSON array wrapped in prose', () => {
    const raw = 'Sure! Here are some ideas:\n["Wrapped one", "Wrapped two"]\nHope this helps.'
    expect(parseSuggestions(raw)).toEqual(['Wrapped one', 'Wrapped two'])
  })

  it('unwraps objects when the model returns keyed entries', () => {
    const raw = '[{"suggestion": "From a key"}, {"text": "From another"}]'
    expect(parseSuggestions(raw)).toEqual(['From a key', 'From another'])
  })

  it('falls back to a numbered list when JSON is not used', () => {
    const raw = '1. Ask for concrete evidence\n2. Challenge the core assumption\n3. Redirect to the neglected angle'
    expect(parseSuggestions(raw)).toEqual([
      'Ask for concrete evidence',
      'Challenge the core assumption',
      'Redirect to the neglected angle',
    ])
  })

  it('falls back to a bulleted list and drops the markers', () => {
    const raw = '- Push on the cost question\n* Ask Bob to substantiate the claim'
    expect(parseSuggestions(raw)).toEqual(['Push on the cost question', 'Ask Bob to substantiate the claim'])
  })

  it('strips surrounding quotes', () => {
    expect(parseSuggestions('"A quoted suggestion line"')).toEqual(['A quoted suggestion line'])
  })

  it('removes duplicates case-insensitively', () => {
    expect(parseSuggestions('["Same thing", "SAME THING", "Other"]')).toEqual(['Same thing', 'Other'])
  })

  it('honours the max count', () => {
    expect(parseSuggestions('["a1234567", "b1234567", "c1234567"]', { max: 2 })).toHaveLength(2)
  })

  it('returns an empty list for unusable answers', () => {
    expect(parseSuggestions('')).toEqual([])
    expect(parseSuggestions(null)).toEqual([])
    expect(parseSuggestions('   ')).toEqual([])
  })

  it('skips heading-like lines in the fallback path', () => {
    const raw = 'Suggestions:\nAsk for the underlying data source'
    expect(parseSuggestions(raw)).toEqual(['Ask for the underlying data source'])
  })
})

describe('participantMode', () => {
  it('keeps each participant wand independent and recognisable', () => {
    expect(participantMode(2)).toBe('participant:2')
    expect(isParticipantMode(participantMode(0))).toBe(true)
    expect(isParticipantMode(SUGGESTION_MODE.STEER)).toBe(false)
    expect(isParticipantMode(undefined)).toBe(false)
  })
})

describe('buildParticipantPrompt', () => {
  it('asks for a real person when a character type is selected', () => {
    const prompt = buildParticipantPrompt({
      characterType: 'historical',
      characterTypeLabel: 'historical figure',
      topic: 'Nuclear power',
      others: [{ name: 'Alice', traits: ['You argue from economics.'] }],
      languageOptions: ['en', 'it'],
    })
    expect(prompt).toContain('real, recognisable historical figure')
    expect(prompt).toContain('- Alice — You argue from economics.')
    expect(prompt).toContain('Never duplicate an existing participant')
    expect(prompt).toContain('[en, it]')
  })

  it('asks for an invented person for the plain type', () => {
    const prompt = buildParticipantPrompt({ characterType: null, characterTypeLabel: 'Person' })
    expect(prompt).toContain('invented but believable person')
    expect(prompt).toContain('No other participants yet')
  })

  it('includes the shared debate mode in character proposals', () => {
    const prompt = buildParticipantPrompt({
      characterTypeLabel: 'Person',
      debateMode: 'red_team',
      debateModeLabel: 'Red Team',
      debateModeInstruction: 'Attack the strongest proposal and expose failure modes.',
    })
    expect(prompt).toContain('Shared debate mode: Red Team (red_team).')
    expect(prompt).toContain('Attack the strongest proposal and expose failure modes.')
  })

  it('asks for facilitation traits when the participant is a moderator', () => {
    const prompt = buildParticipantPrompt({
      characterTypeLabel: 'Person',
      isModerator: true,
      moderatorMode: 'facilitator',
    })
    expect(prompt).toContain('marked as the debate moderator')
    expect(prompt).toContain('impartial facilitation')
    expect(prompt).toContain('facilitator moderation style')
    expect(prompt).toContain('primarily as an advocate')
    expect(prompt).toContain('Prefer "null (Free) for this moderator"')
  })

  it('passes the constraint limit to character generation', () => {
    const prompt = buildParticipantPrompt({ characterTypeLabel: 'Person' })
    expect(prompt).toContain(`at most ${MAX_CONSTRAINT_CHARS} characters`)
    expect(prompt).toContain('use additional trait entries instead of truncating it')
    expect(prompt).toContain('Prefer "short"')
  })

  it('never asks for a model, endpoint or affinity', () => {
    const prompt = buildParticipantPrompt({ characterType: null, characterTypeLabel: 'Person' })
    for (const forbidden of ['model', 'endpoint', 'affinity']) {
      expect(prompt.toLowerCase()).not.toContain(forbidden)
    }
  })

  it('offers the available moods and the intensity scale', () => {
    const prompt = buildParticipantPrompt({
      characterType: null,
      characterTypeLabel: 'Person',
      moodOptions: ['none', 'diplomatic', 'analytical'],
    })
    expect(prompt).toContain('[none, diplomatic, analytical]')
    expect(prompt).toContain('"moodIntensity"')
    expect(prompt).toContain('4 (extreme)')
  })
})

describe('parseParticipantDrafts', () => {
  const languageOptions = ['en', 'it', 'de']
  const moodOptions = ['none', 'diplomatic', 'analytical', 'antagonist']

  it('reads a well-formed draft', () => {
    const raw = JSON.stringify([{
      name: 'Marie Curie',
      traits: ['You argue from laboratory evidence.', 'You distrust unfounded speculation.'],
      ageGroup: 3,
      educationLevel: 'expert',
      responseLength: 'short',
      mood: 'analytical',
      moodIntensity: 3,
      reasoningLang: 'it',
    }])
    expect(parseParticipantDrafts(raw, { languageOptions, moodOptions })).toEqual([{
      name: 'Marie Curie',
      traits: ['You argue from laboratory evidence.', 'You distrust unfounded speculation.'],
      ageGroup: 3,
      educationLevel: 'expert',
      responseLength: 'short',
      mood: 'analytical',
      moodIntensity: 3,
      reasoningLang: 'it',
    }])
  })

  it('accepts a mood intensity written as a label', () => {
    const raw = JSON.stringify([{ name: 'A', traits: [], mood: 'Analytical', moodIntensity: 'extreme' }])
    expect(parseParticipantDrafts(raw, { moodOptions })[0]).toMatchObject({
      mood: 'analytical',
      moodIntensity: 4,
    })
  })

  it('rejects a mood that is not among the offered ids', () => {
    const raw = JSON.stringify([{ name: 'B', traits: [], mood: 'sarcastic', moodIntensity: 9 }])
    expect(parseParticipantDrafts(raw, { moodOptions })[0]).toMatchObject({
      mood: null,
      moodIntensity: null,
    })
  })

  it('accepts age written as a label instead of an index', () => {
    const raw = JSON.stringify([{ name: 'A', traits: [], ageGroup: 'Elder' }])
    expect(parseParticipantDrafts(raw)[0].ageGroup).toBe(4)
  })

  it('nulls out values the selectors cannot represent', () => {
    const raw = JSON.stringify([{
      name: 'B',
      traits: [],
      ageGroup: 99,
      educationLevel: 'postdoctoral',
      reasoningLang: 'klingon',
    }])
    expect(parseParticipantDrafts(raw, { languageOptions })[0]).toMatchObject({
      ageGroup: null,
      educationLevel: null,
      reasoningLang: '',
    })
  })

  it('rejects a language that is not among the offered codes', () => {
    const raw = JSON.stringify([{ name: 'C', traits: [], reasoningLang: 'fr' }])
    expect(parseParticipantDrafts(raw, { languageOptions })[0].reasoningLang).toBe('')
  })

  it('drops entries with no usable name and deduplicates by name', () => {
    const raw = JSON.stringify([
      { name: '', traits: ['x'] },
      { name: 'Dup', traits: [] },
      { name: 'dup', traits: [] },
    ])
    expect(parseParticipantDrafts(raw).map(d => d.name)).toEqual(['Dup'])
  })

  it('keeps generated traits and discards fragments', () => {
    const raw = JSON.stringify([{
      name: 'D',
      traits: ['ok', 'A proper trait sentence.', 'Another proper trait.', 'A third proper trait.', 'A fourth one here.'],
    }])
    expect(parseParticipantDrafts(raw)[0].traits).toEqual([
      'A proper trait sentence.',
      'Another proper trait.',
      'A third proper trait.',
      'A fourth one here.',
    ])
  })

  it('splits an oversized generated constraint without truncating it', () => {
    const first = 'You argue from evidence. '.repeat(60)
    const raw = JSON.stringify([{ name: 'Long Persona', traits: [first] }])
    const traits = parseParticipantDrafts(raw)[0].traits

    expect(traits.length).toBeGreaterThan(1)
    expect(traits.every(trait => trait.length <= MAX_CONSTRAINT_CHARS)).toBe(true)
    expect(traits.join(' ')).toBe(first.trim())
  })

  it('returns nothing for unusable answers', () => {
    expect(parseParticipantDrafts('not json')).toEqual([])
    expect(parseParticipantDrafts('{"name":"solo object"}')).toEqual([])
    expect(parseParticipantDrafts('')).toEqual([])
  })

  it('reads a fenced array wrapped in prose', () => {
    const raw = 'Here you go:\n```json\n[{"name":"Eve","traits":["You focus on ethics."]}]\n```'
    expect(parseParticipantDrafts(raw)[0].name).toBe('Eve')
  })
})

describe('buildGlobalRulesPrompt', () => {
  it('grounds the rules in the mode and in the stated purpose', () => {
    const prompt = buildGlobalRulesPrompt({
      debateMode: 'decision',
      debateModeLabel: 'Decision',
      debateModeInstruction: 'Reach a decision.',
      purpose: 'Pick a payment provider',
      count: 3,
    })
    expect(prompt).toContain('Shared debate mode: Decision (decision). Reach a decision.')
    expect(prompt).toContain('What this debate is for:\nPick a payment provider')
    expect(prompt).toContain('Return exactly 3 strings in a JSON array.')
  })

  it('falls back to the mode alone when no purpose was given', () => {
    const prompt = buildGlobalRulesPrompt({ debateMode: 'free', purpose: '   ' })
    expect(prompt).toContain('derive the rules from the debate mode alone')
    expect(prompt).not.toContain('What this debate is for')
  })

  it('keeps the rules collective, never aimed at one participant', () => {
    const prompt = buildGlobalRulesPrompt({ purpose: 'anything' })
    expect(prompt).toContain('Never name a participant')
    expect(prompt).toContain('never assign anyone a position')
  })
})
