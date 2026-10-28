# src/hooks/useDebateWizard.js

**Role** — The state machine of the setup wizard that generates a topic and a cast of participants.

**Notes**

- Builds its own prompts (`buildGlobalRulesPrompt`, `buildParticipantPrompt`, `buildParticipantSystemPrompt` from `services/Suggestions.js`) rather than reusing the debate's, because the wizard asks a model to *produce* configuration text, not to take part.
- The prompt is composed with the same vocabulary the app uses elsewhere — character types, moods, debate modes, output language (`outputLanguagePhrase`) — so generated personas are expressed in terms the rest of the app understands.
- Streams through `debate/Stream.js`, so the wizard can be stopped and cleaned like any other request.
- Exercises: `tests/WizardTopic.test.js`.
