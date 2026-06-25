import { UI_OPTION_LABELS } from '../i18n/UiStrings'

export const MOOD_INTENSITY = [
	{ value: 0, label: UI_OPTION_LABELS.moodIntensity[0], labelEn: 'Low', instruction: 'Express your mood very subtly — it should be barely noticeable, only occasionally hinting at your disposition.' },
	{ value: 1, label: UI_OPTION_LABELS.moodIntensity[1], labelEn: 'Light', instruction: 'Express your mood lightly — it colors your tone but remains secondary to the substance of your arguments.' },
	{ value: 2, label: UI_OPTION_LABELS.moodIntensity[2], labelEn: 'Balanced', instruction: 'Express your mood clearly and consistently, without letting it overwhelm the content of your contributions.' },
	{ value: 3, label: UI_OPTION_LABELS.moodIntensity[3], labelEn: 'Strong', instruction: 'Your mood is dominant and persistent — it visibly shapes every response, your word choices, and how you engage with others.' },
	{ value: 4, label: UI_OPTION_LABELS.moodIntensity[4], labelEn: 'Extreme', instruction: 'Your mood is all-consuming and unwavering — it defines every sentence, drives every reaction, and overrides any temptation toward neutrality.' },
];
