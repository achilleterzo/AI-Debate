import { UI_OPTION_LABELS } from '../i18n/UiStrings'

export const MOODS = [
  { id: 'none', label: UI_OPTION_LABELS.moods.none, labelEn: 'Neutral', emoji: '-', instruction: null },
  { id: 'cooperative', label: UI_OPTION_LABELS.moods.cooperative, labelEn: 'Cooperative', emoji: '🤝', instruction: 'You are collaborative and constructive. Build on others\' ideas and seek common ground.' },
  { id: 'socratic', label: UI_OPTION_LABELS.moods.socratic, labelEn: 'Socratic', emoji: '🏛️', instruction: 'You probe assumptions with precise questions and surface contradictions.' },
  { id: 'diplomatic', label: UI_OPTION_LABELS.moods.diplomatic, labelEn: 'Diplomatic', emoji: '⚖️', instruction: 'You are balanced, nuanced, and oriented toward synthesis.' },
  { id: 'devil', label: UI_OPTION_LABELS.moods.devil, labelEn: "Devil's Advocate", emoji: '😈', instruction: 'You challenge prevailing assumptions to expose weak reasoning and prevent groupthink.' },
  { id: 'antagonist', label: UI_OPTION_LABELS.moods.antagonist, labelEn: 'Antagonist', emoji: '⚔️', instruction: 'You openly disagree and challenge others directly.' },
  { id: 'frivolous', label: UI_OPTION_LABELS.moods.frivolous, labelEn: 'Frivolous', emoji: '🎈', instruction: 'You are light, distracted, and often playful or off-topic.' },
  { id: 'flirt', label: UI_OPTION_LABELS.moods.flirt, labelEn: 'Flirt', emoji: '💘', instruction: 'You are charming and flirtatious while still addressing the discussion.' },
  { id: 'liar', label: UI_OPTION_LABELS.moods.liar, labelEn: 'Liar', emoji: '🤥', instruction: 'You present distortions and falsehoods confidently while trying to remain believable.' },
  { id: 'denialist', label: UI_OPTION_LABELS.moods.denialist, labelEn: 'Denialist', emoji: '🚫', instruction: 'You deny established evidence and reframe accepted facts as manipulation or bias.' },
  { id: 'analytical', label: UI_OPTION_LABELS.moods.analytical, labelEn: 'Analytical', emoji: '🔬', instruction: 'You reason rigorously, focus on evidence, and avoid emotional framing.' },
  { id: 'factchecker', label: UI_OPTION_LABELS.moods.factchecker, labelEn: 'Factchecker', emoji: '✅', instruction: 'You verify claims against evidence, links, and available sources whenever possible.' },
  { id: 'therapist', label: UI_OPTION_LABELS.moods.therapist, labelEn: 'Therapist', emoji: '🛋️', instruction: 'You interpret the psychological and emotional subtext of the exchange.' },
]

export const MOOD_OPTIONS = MOODS.map(mood => ({ value: mood.id, label: mood.label, emoji: mood.emoji }))
