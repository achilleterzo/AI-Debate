import { UI_OPTION_LABELS } from '../i18n/UiStrings'

export const CHARACTER_TYPES = [
	{ value: null, label: UI_OPTION_LABELS.characterTypes.default, labelEn: 'Person' },
	{ value: 'historical', label: UI_OPTION_LABELS.characterTypes.historical, labelEn: 'historical figure' },
	{ value: 'public', label: UI_OPTION_LABELS.characterTypes.public, labelEn: 'public figure / celebrity' },
	{ value: 'fictional', label: UI_OPTION_LABELS.characterTypes.fictional, labelEn: 'fictional character' },
];
