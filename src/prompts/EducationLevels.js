import { UI_OPTION_LABELS } from '../i18n/UiStrings'

export const EDUCATION_LEVELS = [
	{ value: null, label: UI_OPTION_LABELS.educationLevels.default, labelEn: 'Model default', instruction: null },
	{ value: 'street', label: UI_OPTION_LABELS.educationLevels.street, labelEn: 'Street-smart', instruction: 'You have no formal education. You reason from lived experience, common sense, and practical wisdom. Avoid technical jargon; use concrete, everyday language and real-life analogies.' },
	{ value: 'primary', label: UI_OPTION_LABELS.educationLevels.primary, labelEn: 'Primary school', instruction: 'Your education is limited to primary school. Use simple words, short sentences, and avoid complex concepts. You may make occasional grammatical mistakes.' },
	{ value: 'proficient', label: UI_OPTION_LABELS.educationLevels.proficient, labelEn: 'Proficient', instruction: 'You have a good general education (high-school level). You can discuss most topics competently using clear, correct language without overly academic vocabulary.' },
	{ value: 'academic', label: UI_OPTION_LABELS.educationLevels.academic, labelEn: 'Academic', instruction: 'You have a university degree. You use precise terminology, structured reasoning, and are comfortable with abstract concepts and references to research or literature.' },
	{ value: 'expert', label: UI_OPTION_LABELS.educationLevels.expert, labelEn: 'Expert', instruction: 'You hold a master\u2019s degree or equivalent specialisation. You communicate with domain expertise, nuance, and precision. You naturally reference specialised frameworks, methodologies, and scholarly debate.' },
];
