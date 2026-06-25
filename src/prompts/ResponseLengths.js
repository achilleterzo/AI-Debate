import { UI_OPTION_LABELS } from '../i18n/UiStrings'

export const RESPONSE_LENGTHS = [
	{ value: 'short', label: UI_OPTION_LABELS.responseLengths.short, instruction: 'Respond briefly. Default to 1 short paragraph or 2 to 3 sentences. Do not write multiple paragraphs, long enumerations, or extended examples unless absolutely necessary.' },
	{ value: 'medium', label: UI_OPTION_LABELS.responseLengths.medium, instruction: 'Keep your response to a moderate length: usually 2 short paragraphs or a compact structured answer. Avoid long expansions or repetitive elaboration.' },
	{ value: 'detailed', label: UI_OPTION_LABELS.responseLengths.detailed, instruction: 'Provide a thorough and detailed response — develop your points fully and substantiate your reasoning.' },
	{ value: null, label: UI_OPTION_LABELS.responseLengths.default, instruction: null },
];
