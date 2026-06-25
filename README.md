# AI Debate

`AI Debate` is a React + Vite application for simulating structured multi-participant debates on top of Ollama-compatible models.

It lets you configure multiple participants, assign each one a model and behavioral profile, run turn-based conversations, inject moderator interjections, generate summaries and analytical conclusions, and export the whole session.

## What It Does

- Run debates between multiple AI participants
- Support a manual `User` participant inside the debate flow
- Configure participant traits:
  - character type
  - response length
  - mood and mood intensity
  - age group
  - education level
  - moderator role and moderator behavior
- Apply participant-level and global constraints
- Track dynamic affinity between participants
- Generate rolling conversation summaries
- Generate post-debate conclusions such as:
  - summary
  - considerations
  - contradictions
  - blindspots
  - verdict
  - next steps
  - custom conclusion prompt
- Attach `.txt`, `.md`, and `.pdf` documents as debate context
- Export sessions as:
  - HTML
  - Markdown
  - JSON
- Save and reload local snapshots/configuration

## Tech Stack

- React 19
- Vite
- React Select
- Marked
- pdf.js
- jsPDF

## Requirements

- Node.js
- npm
- An Ollama-compatible endpoint

Default local endpoint:

```text
http://localhost:11434
```

## Supported Models

`AI Debate` currently supports both:

- local Ollama models
- Ollama cloud models

To make a cloud model appear in the app model selector, first run it once from the shell through Ollama.

Example:

```bash
ollama run gemma4:31b-cloud
```

In general:

```bash
ollama run "model-name:cloud"
```

After the model has been started once, it should become available in the app model list.

## Typical Workflow

1. Start Ollama or point the app to a compatible remote endpoint.
2. Open the app.
3. Configure participants and choose models.
4. Enter the debate topic.
5. Start the session.
6. Optionally:
   - inject interjections while the debate is running
   - add attached documents
   - tune summary behavior
   - reset affinities
7. Generate analytical conclusions.
8. Export the result or save a JSON snapshot.

## Exports

The app can export debate sessions to:

- `HTML` for styled viewing
- `Markdown` for portable text output
- `JSON` for restoring or inspecting structured state

## Next

- Full support to remote User participants
- Images as attachments (pre parsed and summarized)
