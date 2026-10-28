# src/providers/gemini.js

**Role** — Gemini through Google AI Studio's OpenAI-compatible endpoint.

**Notes**

- The same dialect as OpenRouter, with two differences worth naming: the effort is a flat `reasoning_effort`, and the model listing returns everything the key can reach — embedding, image, audio and more — so only text models are offered.
- `NOT_TEXT` is the exclusion list by name: `embedding|image|imagen|tts|audio|live|robotics|computer-use|veo|aqa`. Ids are normalized (a leading `models/` is stripped) and must start with `gemini-`.
- No capability lookup: the models it offers are multimodal and support tools, so `modelCapabilities` answers `['tools', 'thinking', 'vision']` directly.
- `usage` is asked for as a stream option here (`stream_options.include_usage`), not as a request option — that is how this API reports it.
