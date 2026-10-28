# src/components/InputActionButtons.jsx

**Role** — The row of controls under the composer: attach, start, stop, force stop, intervene, resume.

**Notes**

- Also owns the hidden file input, and therefore the `accept` list — the one place where the file types a user can attach are enumerated. It mirrors `IMAGE_EXTENSIONS` in `services/Images.js` for the image half; keep the two in step.
- Every control is gated by a condition passed in rather than by internal state: `hasTopic`, `allModelsSet`, `ollamaOk`, `canStart`, `canResume`, `running`, `stopping`, `messages`. The reasons live with the state (in `App`), and the component only decides what to show.
- `onForceStop` is separate from `onStop` because a graceful stop waits for the current turn, and a stuck provider needs the harder one.
- The file input is cleared (`e.target.value = ''`) after each selection, so choosing the same file twice still fires an event.

