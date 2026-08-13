export const DEFAULT_RESPONSE_LENGTH = 'short'

export const RESPONSE_LENGTHS = [
	{ value: 'short', constraints: { default: 'Respond briefly. Default to 1 short paragraph or 2 to 3 sentences. Do not write multiple paragraphs, long enumerations, or extended examples unless absolutely necessary.' } },
	{ value: 'medium', constraints: { default: 'Keep your response to a moderate length: usually 2 short paragraphs or a compact structured answer. Avoid long expansions or repetitive elaboration.' } },
	{ value: 'detailed', constraints: { default: 'Provide a thorough and detailed response — develop your points fully and substantiate your reasoning.' } },
	{ value: null, constraints: { default: null } },
];
