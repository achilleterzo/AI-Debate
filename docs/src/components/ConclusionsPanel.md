# src/components/ConclusionsPanel.jsx

**Role** — Choosing and generating the closing output of a debate, and showing what was produced.

**Notes**

- Conclusion state is passed in as one `conclusions` object (from `hooks/useConclusions.js`): the type, the custom prompt, the per-type guidance (`standardConclusionPrompts`, `standardPromptsVersion`), the refs, the running flag, the effective model and the generator.
- Guidance is **per type** (`prompts/ConclusionTypes.js`): the panel shows the field for the type currently selected, so a note written for a Summary is not silently sent with a Verdict.
- The wand uses `SUGGESTION_MODE.CONCLUSION` to propose guidance inferred from how the debate actually went.
- The comment about reading `promptRefs.standard` into a local first is a real constraint: reading a property of a ref holder during render is refused by the compiler lint, so it is destructured once at the top.
- `running` restricts generation while the debate is in progress; the type list comes from `CONCLUSION_TYPES` and is labelled with `conclusionTypeLabel`.
