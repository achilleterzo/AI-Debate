export const DEFAULT_RESPONSE_LENGTH = 'short'

// Every level is written as a ceiling, not as a preference. The escape hatches
// that used to close these lines ("unless absolutely necessary") were the door
// any content rule asking for argument or substantiation walked straight
// through: the model satisfied it by expanding instead of by selecting.
export const RESPONSE_LENGTHS = [
	{ value: 'short', constraints: { default: 'Respond briefly: at most one paragraph of 2 to 4 sentences. No second paragraph, no bullet lists, no headings, no worked examples. If you have more material than fits, keep your single strongest point and drop the rest — cutting content is the correct way to stay inside this limit.' } },
	{ value: 'medium', constraints: { default: 'Keep your response to a moderate length: at most 2 short paragraphs, roughly 8 sentences, or an equally compact structured answer. If you have more material than fits, select the strongest points and drop the rest instead of expanding.' } },
	{ value: 'detailed', constraints: { default: 'Provide a thorough and detailed response — develop your points fully and substantiate your reasoning. Length still serves the argument: do not pad, repeat, or restate what you have already established.' } },
	{ value: null, constraints: { default: null } },
];
